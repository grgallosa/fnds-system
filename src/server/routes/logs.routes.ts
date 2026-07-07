import { Router } from "express";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { activityLogs, auditRecords } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

const router = Router();

router.get(
  "/activity",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)));
  })
);

router.get(
  "/audit",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await db.select().from(auditRecords).orderBy(desc(auditRecords.timestamp)));
  })
);

export default router;
