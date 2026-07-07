import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { notifications } from "../../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { asyncHandler, notFound } from "../utils/asyncHandler.ts";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.forRole, req.user!.role))
      .orderBy(desc(notifications.timestamp));
    res.json(rows);
  })
);

router.patch(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(notifications).where(eq(notifications.id, req.params.id));
    if (!existing) throw notFound("Notification");
    if (existing.forRole !== req.user!.role) {
      return res.status(403).json({ error: "This notification does not belong to your role" });
    }
    const [updated] = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, req.params.id))
      .returning();
    res.json(updated);
  })
);

export default router;
