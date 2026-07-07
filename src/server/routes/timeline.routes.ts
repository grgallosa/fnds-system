import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { customerTimelineEvents, customers } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { asyncHandler, ApiError } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { z } from "zod";
import { validateBody } from "../middleware/validate.ts";

const router = Router();

router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(customerTimelineEvents)
      .orderBy(desc(customerTimelineEvents.timestamp));
    res.json(rows);
  })
);

const timelineEventSchema = z.object({
  customerId: z.string().min(1),
  action: z.string().min(1),
  description: z.string().min(1),
});

router.post(
  "/",
  requireAdmin,
  validateBody(timelineEventSchema),
  asyncHandler(async (req, res) => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, req.body.customerId));
    if (!customer) throw new ApiError(400, "Customer does not exist");

    const [created] = await db
      .insert(customerTimelineEvents)
      .values({ id: ids.timelineEvent(), ...req.body })
      .returning();
    res.status(201).json(created);
  })
);

export default router;
