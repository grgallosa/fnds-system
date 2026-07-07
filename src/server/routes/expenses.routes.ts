import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { expenses } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validate.ts";
import { expenseCreateSchema, expenseUpdateSchema } from "../validation/schemas.ts";
import { asyncHandler, notFound } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { recordActivity } from "../utils/activity.ts";

const router = Router();

// Expenses are admin-only per spec ("View sales and expenses" is an admin item).
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await db.select().from(expenses));
  })
);

router.get(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [row] = await db.select().from(expenses).where(eq(expenses.id, req.params.id));
    if (!row) throw notFound("Expense");
    res.json(row);
  })
);

router.post(
  "/",
  requireAdmin,
  validateBody(expenseCreateSchema),
  asyncHandler(async (req, res) => {
    const [created] = await db
      .insert(expenses)
      .values({
        id: ids.expense(),
        ...req.body,
        amount: String(req.body.amount),
        recordedByUserId: req.user!.userId,
        recordedBy: req.user!.username,
      })
      .returning();
    await recordActivity(req.user!, "Recorded company expense", created.id);
    res.status(201).json(created);
  })
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(expenseUpdateSchema),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, req.params.id));
    if (!existing) throw notFound("Expense");

    const body = { ...req.body };
    if (body.amount !== undefined) {
      body.amount = String(body.amount) as unknown as number;
    }

    const [updated] = await db
      .update(expenses)
      .set(body)
      .where(eq(expenses.id, req.params.id))
      .returning();
    res.json(updated);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, req.params.id));
    if (!existing) throw notFound("Expense");
    await db.delete(expenses).where(eq(expenses.id, req.params.id));
    res.status(204).send();
  })
);

export default router;
