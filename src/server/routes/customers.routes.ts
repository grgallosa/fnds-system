import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { customers, payments } from "../../db/schema.ts";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validate.ts";
import { customerCreateSchema, customerUpdateSchema } from "../validation/schemas.ts";
import { asyncHandler, ApiError, notFound } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { recordActivity, recordAudit } from "../utils/activity.ts";
import { deriveDueDay, computeBillingStatus, todayStr } from "../utils/billing.ts";
import { generateFirstInvoiceForCustomer } from "../services/billing.service.ts";

const router = Router();

// Both roles can read customer info (technicians need it for assigned tasks).
router.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(customers);
    res.json(rows);
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [row] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!row) throw notFound("Customer");
    res.json(row);
  })
);

// Only admins can create/edit/delete customers.
router.post(
  "/",
  requireAdmin,
  validateBody(customerCreateSchema),
  asyncHandler(async (req, res) => {
    const id = ids.customer();
    const body = req.body;

    const [plan] = await db.query.plans.findMany({
      where: (p, { eq }) => eq(p.id, body.currentPlanId),
    });
    if (!plan) throw new ApiError(400, "Selected plan does not exist");

    // Billing schedule: billingStartDate defaults to the installation date,
    // and the recurring due day is derived from it unless explicitly
    // overridden. The very first cycle's due date is the billing start
    // date itself (see billing.service.ts for how subsequent cycles roll).
    const billingStartDate = body.billingStartDate || body.installationDate;
    const dueDay = body.dueDay ?? deriveDueDay(billingStartDate);
    const nextDueDate = billingStartDate;
    const billingStatus = computeBillingStatus(nextDueDate);

    const [created] = await db
      .insert(customers)
      .values({
        id,
        fullName: body.fullName,
        address: body.address,
        contactNumber: body.contactNumber,
        email: body.email,
        installationDate: body.installationDate,
        currentPlanId: body.currentPlanId,
        monthlyFee: String(body.monthlyFee ?? plan.monthlyPrice),
        status: body.status,
        username: body.username,
        billingStartDate,
        dueDay,
        nextDueDate,
        billingStatus,
      })
      .returning();

    // Every Active customer should have a first invoice waiting for their
    // opening billing cycle - generated here rather than left for the
    // scheduler so the customer's billing tab isn't empty until the next
    // daily tick.
    if (created.status === "Active") {
      await generateFirstInvoiceForCustomer(created);
    }

    await recordActivity(req.user!, "Created customer account", created.id);
    await recordAudit(req.user!, "Created New Customer", "None", `ID: ${created.id}, Name: ${created.fullName}`);

    res.status(201).json(created);
  })
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(customerUpdateSchema),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!existing) throw notFound("Customer");

    const body = req.body;
    let monthlyFee: string | undefined;
    if (body.monthlyFee !== undefined) {
      monthlyFee = String(body.monthlyFee);
    } else if (body.currentPlanId) {
      const [plan] = await db.query.plans.findMany({
        where: (p, { eq }) => eq(p.id, body.currentPlanId),
      });
      if (!plan) throw new ApiError(400, "Selected plan does not exist");
      monthlyFee = String(plan.monthlyPrice);
    }

    // If the billing start date is being changed, re-derive the due day
    // unless the caller explicitly supplied one in the same request.
    let dueDay: number | undefined = body.dueDay;
    if (body.billingStartDate && dueDay === undefined) {
      dueDay = deriveDueDay(body.billingStartDate);
    }

    const { monthlyFee: _omit, ...rest } = body;
    const [updated] = await db
      .update(customers)
      .set({
        ...rest,
        ...(monthlyFee ? { monthlyFee } : {}),
        ...(dueDay !== undefined ? { dueDay } : {}),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, req.params.id))
      .returning();

    // Reactivating a customer (Suspended/Disconnected -> Active): reset
    // their billing cycle to start today rather than keeping a stale
    // nextDueDate from before the suspension. Deliberate choice - the
    // billing cycle restarts from the day of reactivation; there is no
    // retroactive charge for the time the customer was suspended, and no
    // proration of the partial final cycle before suspension either. This
    // also prevents them from showing as Overdue the instant they're
    // reactivated just because of stale suspended-period math.
    let reactivatedCustomer = updated;
    if (body.status === "Active" && existing.status !== "Active") {
      const resetNextDueDate = todayStr();
      const resetBillingStatus = computeBillingStatus(resetNextDueDate);
      const [refreshed] = await db
        .update(customers)
        .set({
          nextDueDate: resetNextDueDate,
          billingStatus: resetBillingStatus,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, req.params.id))
        .returning();
      reactivatedCustomer = refreshed;
      await generateFirstInvoiceForCustomer(reactivatedCustomer);
    }

    await recordActivity(req.user!, "Modified customer record", req.params.id);
    const changes: string[] = [];
    if (body.status && body.status !== existing.status) {
      changes.push(`Status: ${existing.status} -> ${body.status}`);
    }
    if (body.currentPlanId && body.currentPlanId !== existing.currentPlanId) {
      changes.push(`Plan changed to ${body.currentPlanId}`);
    }
    if (body.billingStartDate && body.billingStartDate !== existing.billingStartDate) {
      changes.push(`Billing start date changed to ${body.billingStartDate}`);
    }
    if (changes.length > 0) {
      await recordAudit(req.user!, "Modified Subscriber Account", `Customer: ${req.params.id}`, changes.join(", "));
    }

    res.json(reactivatedCustomer);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(customers).where(eq(customers.id, req.params.id));
    if (!existing) throw notFound("Customer");

    // Customers can be hard-deleted only if they have never made a payment.
    // Invoices/repairTasks/customerTimelineEvents referencing this customer
    // are onDelete: "cascade" and would be removed automatically, but
    // payments are onDelete: "restrict" (permanent audit record - see
    // schema.ts) - and since a customer's invoices cascade-delete along with
    // the customer, any payment row referencing one of those invoices would
    // block the DB delete with an FK violation. Check explicitly and reject
    // with a clear message instead of letting that violation surface as a
    // generic 500.
    const [existingPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.customerId, req.params.id))
      .limit(1);
    if (existingPayment) {
      throw new ApiError(
        409,
        "Cannot delete a customer with payment history. Suspend or disconnect them instead."
      );
    }

    await db.delete(customers).where(eq(customers.id, req.params.id));

    await recordActivity(req.user!, "Deleted customer account", req.params.id);
    await recordAudit(
      req.user!,
      "Deleted Customer",
      `ID: ${existing.id}, Name: ${existing.fullName}`,
      "None"
    );

    res.status(204).send();
  })
);

export default router;