import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { invoices, customers, payments } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validate.ts";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  invoicePaymentSchema,
} from "../validation/schemas.ts";
import { asyncHandler, ApiError, notFound } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { recordActivity } from "../utils/activity.ts";
import {
  recordInvoicePayment,
  generateMonthlyInvoicesForActiveCustomers,
  generateInvoiceNumber,
} from "../services/billing.service.ts";

const router = Router();

// Billing is admin-visible only per spec ("Admin should be able to view
// billing and invoices"). Technicians have no billing access.
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        customerId: invoices.customerId,
        customerName: customers.fullName,
        billingPeriodStart: invoices.billingPeriodStart,
        billingPeriodEnd: invoices.billingPeriodEnd,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        status: invoices.status,
        paymentDate: invoices.paymentDate,
        paymentMethod: invoices.paymentMethod,
        notes: invoices.notes,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id));
    res.json(rows);
  })
);

router.get(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
    if (!row) throw notFound("Invoice");
    res.json(row);
  })
);

// Manually triggers the same monthly-generation logic the scheduler runs
// automatically - useful for an admin who doesn't want to wait for the
// next daily tick (e.g. right after seeding data, or in a demo).
router.post(
  "/generate-monthly",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const generated = await generateMonthlyInvoicesForActiveCustomers();
    await recordActivity(req.user!, "Manually triggered monthly invoice generation", `${generated} invoice(s)`);
    res.json({ generated });
  })
);

// Ad-hoc invoice creation (e.g. a one-off charge). Recurring monthly
// invoices are generated automatically by the billing service - this
// endpoint is for exceptions, not the normal monthly cadence.
router.post(
  "/",
  requireAdmin,
  validateBody(invoiceCreateSchema),
  asyncHandler(async (req, res) => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, req.body.customerId));
    if (!customer) throw new ApiError(400, "Customer does not exist");

    const year = new Date(req.body.dueDate).getUTCFullYear();
    const invoiceNumber = await generateInvoiceNumber(year);

    const [created] = await db
      .insert(invoices)
      .values({
        id: ids.invoice(),
        invoiceNumber,
        ...req.body,
        amount: String(req.body.amount),
      })
      .returning();
    await recordActivity(req.user!, "Generated manual invoice", created.id);
    res.status(201).json(created);
  })
);

// The full "record a payment" flow: marks the invoice Paid, writes a
// permanent payment record, advances the customer's next due date, and
// generates the next month's invoice. This is the only supported way to
// mark an invoice Paid (see the guard in PUT below) so the side effects
// always happen together.
router.post(
  "/:id/pay",
  requireAdmin,
  validateBody(invoicePaymentSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await recordInvoicePayment(req.params.id, req.body);
      await recordActivity(req.user!, "Recorded subscriber payment", req.params.id);
      res.json(result);
    } catch (err: any) {
      if (err?.status) throw new ApiError(err.status, err.message);
      throw err;
    }
  })
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(invoiceUpdateSchema),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
    if (!existing) throw notFound("Invoice");

    // Marking Paid has side effects (payment record, next due date, next
    // invoice) that only /pay performs correctly - block it here so the
    // two code paths can't drift out of sync.
    if (req.body.status === "Paid" && existing.status !== "Paid") {
      throw new ApiError(400, "Use POST /invoices/:id/pay to record a payment");
    }

    const body = { ...req.body };
    if (body.amount !== undefined) {
      body.amount = String(body.amount) as unknown as number;
    }

    const [updated] = await db
      .update(invoices)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(invoices.id, req.params.id))
      .returning();
    await recordActivity(req.user!, "Updated billing invoice", req.params.id);
    res.json(updated);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, req.params.id));
    if (!existing) throw notFound("Invoice");

    // payments.invoiceId is onDelete: "restrict" (permanent audit record -
    // see schema.ts), so deleting a paid invoice with payment history would
    // otherwise throw an unhandled FK violation. Check explicitly and
    // reject with a clear 409 instead.
    const [existingPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.invoiceId, req.params.id))
      .limit(1);
    if (existingPayment) {
      throw new ApiError(
        409,
        "Cannot delete an invoice with payment history. Cancel it instead."
      );
    }

    await db.delete(invoices).where(eq(invoices.id, req.params.id));
    res.status(204).send();
  })
);

export default router;
