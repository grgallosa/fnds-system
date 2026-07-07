import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { technicians, users, repairTasks } from "../../db/schema.ts";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validate.ts";
import {
  technicianCreateSchema,
  technicianUpdateSchema,
} from "../validation/schemas.ts";
import { asyncHandler, ApiError, notFound } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { hashPassword } from "../auth/passwords.ts";
import { z } from "zod";
import { recordActivity, recordAudit } from "../utils/activity.ts";

const router = Router();

router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await db.select().from(technicians));
  })
);

// A technician may fetch their own profile; admins may fetch any.
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN" && req.user!.technicianId !== req.params.id) {
      throw new ApiError(403, "You may only view your own technician profile");
    }
    const [row] = await db.select().from(technicians).where(eq(technicians.id, req.params.id));
    if (!row) throw notFound("Technician");
    res.json(row);
  })
);

router.post(
  "/",
  requireAdmin,
  validateBody(technicianCreateSchema),
  asyncHandler(async (req, res) => {
    const { username, password, ...techFields } = req.body;
    const techId = ids.technician();

    let userId: string | null = null;
    if (username && password) {
      const [existingUser] = await db.select().from(users).where(eq(users.username, username));
      if (existingUser) throw new ApiError(409, "That username is already taken");

      const passwordHash = await hashPassword(password);
      const [createdUser] = await db
        .insert(users)
        .values({
          id: ids.user(),
          username,
          email: techFields.email,
          passwordHash,
          role: "TECHNICIAN",
        })
        .returning();
      userId = createdUser.id;
    }

    const [created] = await db
      .insert(technicians)
      .values({ id: techId, userId, ...techFields })
      .returning();

    await recordActivity(req.user!, "Onboarded field technician", created.id);
    res.status(201).json(created);
  })
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(technicianUpdateSchema),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(technicians).where(eq(technicians.id, req.params.id));
    if (!existing) throw notFound("Technician");

    const [updated] = await db
      .update(technicians)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(technicians.id, req.params.id))
      .returning();
    await recordActivity(req.user!, "Updated technician details", req.params.id);
    res.json(updated);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(technicians).where(eq(technicians.id, req.params.id));
    if (!existing) throw notFound("Technician");

    const [activeTask] = await db
      .select({ id: repairTasks.id })
      .from(repairTasks)
      .where(eq(repairTasks.assignedTechnicianId, req.params.id));
    if (activeTask) {
      throw new ApiError(
        409,
        "Cannot delete a technician with assigned repair tasks. Reassign their tasks first."
      );
    }

    // Deactivate the linked login instead of deleting it outright, so past
    // activity logs/audit records still resolve to a real account.
    if (existing.userId) {
      await db.update(users).set({ isActive: false }).where(eq(users.id, existing.userId));
    }

    await db.delete(technicians).where(eq(technicians.id, req.params.id));
    res.status(204).send();
  })
);

// Set or reset a technician's portal login credentials. Creates the login
// if none exists yet, or resets username/password on an existing one -
// this is what makes "Add technician" without credentials at creation time
// recoverable later, instead of a dead end.
const credentialsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.put(
  "/:id/credentials",
  requireAdmin,
  validateBody(credentialsSchema),
  asyncHandler(async (req, res) => {
    const [tech] = await db.select().from(technicians).where(eq(technicians.id, req.params.id));
    if (!tech) throw notFound("Technician");

    const { username, password } = req.body;
    const passwordHash = await hashPassword(password);

    const [usernameTaken] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    if (usernameTaken && usernameTaken.id !== tech.userId) {
      throw new ApiError(409, "That username is already taken");
    }

    if (tech.userId) {
      await db
        .update(users)
        .set({ username, passwordHash, isActive: true })
        .where(eq(users.id, tech.userId));
    } else {
      const [createdUser] = await db
        .insert(users)
        .values({
          id: ids.user(),
          username,
          email: tech.email,
          passwordHash,
          role: "TECHNICIAN",
        })
        .returning();
      await db.update(technicians).set({ userId: createdUser.id }).where(eq(technicians.id, tech.id));
    }

    await recordActivity(req.user!, "Set technician portal credentials", tech.id);
    res.json({ ok: true });
  })
);

export default router;
