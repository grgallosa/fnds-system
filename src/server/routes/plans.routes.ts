import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { plans, customers } from "../../db/schema.ts";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validate.ts";
import { planCreateSchema, planUpdateSchema } from "../validation/schemas.ts";
import { asyncHandler, ApiError, notFound } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { recordActivity, recordAudit } from "../utils/activity.ts";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await db.select().from(plans));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [row] = await db.select().from(plans).where(eq(plans.id, req.params.id));
    if (!row) throw notFound("Plan");
    res.json(row);
  })
);

router.post(
  "/",
  requireAdmin,
  validateBody(planCreateSchema),
  asyncHandler(async (req, res) => {
    const [created] = await db
      .insert(plans)
      .values({ id: ids.plan(), ...req.body, monthlyPrice: String(req.body.monthlyPrice) })
      .returning();
    await recordActivity(req.user!, "Created internet plan", created.id);
    await recordAudit(req.user!, "Created Internet Plan", "None", `ID: ${created.id}, Name: ${created.name}`);
    res.status(201).json(created);
  })
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(planUpdateSchema),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(plans).where(eq(plans.id, req.params.id));
    if (!existing) throw notFound("Plan");

    const body = { ...req.body };
    if (body.monthlyPrice !== undefined) {
      body.monthlyPrice = String(body.monthlyPrice) as unknown as number;
    }

    const [updated] = await db
      .update(plans)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(plans.id, req.params.id))
      .returning();
    await recordActivity(req.user!, "Modified internet plan", req.params.id);
    res.json(updated);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(plans).where(eq(plans.id, req.params.id));
    if (!existing) throw notFound("Plan");

    const [inUse] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.currentPlanId, req.params.id));
    if (inUse) {
      throw new ApiError(
        409,
        "Cannot delete a plan that customers are currently subscribed to. Set it to Inactive instead, or migrate those customers first."
      );
    }

    await db.delete(plans).where(eq(plans.id, req.params.id));
    res.status(204).send();
  })
);

export default router;
