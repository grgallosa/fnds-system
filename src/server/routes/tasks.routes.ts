import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { repairTasks, customers, technicians, customerTimelineEvents } from "../../db/schema.ts";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";
import { validateBody } from "../middleware/validate.ts";
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskStatusUpdateSchema,
  taskCompletionSchema,
  taskNoteSchema,
} from "../validation/schemas.ts";
import { asyncHandler, ApiError, notFound } from "../utils/asyncHandler.ts";
import { ids } from "../utils/ids.ts";
import { recordActivity } from "../utils/activity.ts";

const router = Router();

// Admin sees every task. Technicians only ever see tasks assigned to them -
// enforced here, not just hidden in the UI.
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: repairTasks.id,
        customerId: repairTasks.customerId,
        customerName: customers.fullName,
        assignedTechnicianId: repairTasks.assignedTechnicianId,
        priority: repairTasks.priority,
        description: repairTasks.description,
        address: repairTasks.address,
        dateCreated: repairTasks.dateCreated,
        scheduledDate: repairTasks.scheduledDate,
        estimatedDuration: repairTasks.estimatedDuration,
        status: repairTasks.status,
        completionDate: repairTasks.completionDate,
        problemFound: repairTasks.problemFound,
        workPerformed: repairTasks.workPerformed,
        materialsUsed: repairTasks.materialsUsed,
        additionalRecommendation: repairTasks.additionalRecommendation,
        completionTime: repairTasks.completionTime,
        customerConfirmation: repairTasks.customerConfirmation,
        photoUrl: repairTasks.photoUrl,
      })
      .from(repairTasks)
      .leftJoin(customers, eq(repairTasks.customerId, customers.id));

    if (req.user!.role === "ADMIN") {
      return res.json(rows);
    }
    if (!req.user!.technicianId) {
      throw new ApiError(403, "No technician profile linked to this account");
    }
    res.json(rows.filter((r) => r.assignedTechnicianId === req.user!.technicianId));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [task] = await db.select().from(repairTasks).where(eq(repairTasks.id, req.params.id));
    if (!task) throw notFound("Repair task");

    if (req.user!.role !== "ADMIN" && task.assignedTechnicianId !== req.user!.technicianId) {
      throw new ApiError(403, "You are not assigned to this task");
    }
    res.json(task);
  })
);

// --- Admin-only: create, full edit, assign, delete ---------------------

router.post(
  "/",
  requireAdmin,
  validateBody(taskCreateSchema),
  asyncHandler(async (req, res) => {
    const [customer] = await db.select().from(customers).where(eq(customers.id, req.body.customerId));
    if (!customer) throw new ApiError(400, "Customer does not exist");

    if (req.body.assignedTechnicianId) {
      const [tech] = await db
        .select()
        .from(technicians)
        .where(eq(technicians.id, req.body.assignedTechnicianId));
      if (!tech) throw new ApiError(400, "Assigned technician does not exist");
    }

    const [created] = await db
      .insert(repairTasks)
      .values({
        id: ids.task(),
        ...req.body,
        dateCreated: new Date().toISOString().slice(0, 10),
        status: req.body.assignedTechnicianId ? "Assigned" : req.body.status,
      })
      .returning();

    await db.insert(customerTimelineEvents).values({
      id: ids.timelineEvent(),
      customerId: customer.id,
      action: "Repair Task Created",
      description: `Task ${created.id} created: ${created.description}`,
    });

    await recordActivity(req.user!, "Dispatched repair order", created.id);

    res.status(201).json(created);
  })
);

router.put(
  "/:id",
  requireAdmin,
  validateBody(taskUpdateSchema),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(repairTasks).where(eq(repairTasks.id, req.params.id));
    if (!existing) throw notFound("Repair task");

    if (req.body.assignedTechnicianId) {
      const [tech] = await db
        .select()
        .from(technicians)
        .where(eq(technicians.id, req.body.assignedTechnicianId));
      if (!tech) throw new ApiError(400, "Assigned technician does not exist");
    }

    const [updated] = await db
      .update(repairTasks)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(repairTasks.id, req.params.id))
      .returning();
    await recordActivity(req.user!, "Edited repair task", req.params.id);
    res.json(updated);
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(repairTasks).where(eq(repairTasks.id, req.params.id));
    if (!existing) throw notFound("Repair task");
    await db.delete(repairTasks).where(eq(repairTasks.id, req.params.id));
    await recordActivity(req.user!, "Deleted repair task", req.params.id);
    res.status(204).send();
  })
);

// --- Shared: status updates (admin: any task, technician: only their own) --

router.patch(
  "/:id/status",
  requireAuth,
  validateBody(taskStatusUpdateSchema),
  asyncHandler(async (req, res) => {
    const [task] = await db.select().from(repairTasks).where(eq(repairTasks.id, req.params.id));
    if (!task) throw notFound("Repair task");

    if (req.user!.role !== "ADMIN" && task.assignedTechnicianId !== req.user!.technicianId) {
      throw new ApiError(403, "You are not assigned to this task");
    }

    const patch: Record<string, unknown> = { status: req.body.status, updatedAt: new Date() };
    if (req.body.status === "Completed") {
      patch.completionDate = new Date().toISOString().slice(0, 10);
    }

    const [updated] = await db
      .update(repairTasks)
      .set(patch)
      .where(eq(repairTasks.id, req.params.id))
      .returning();

    await db.insert(customerTimelineEvents).values({
      id: ids.timelineEvent(),
      customerId: task.customerId,
      action: "Repair Task Status Updated",
      description: `Task ${task.id} status changed to ${req.body.status}`,
    });

    await recordActivity(req.user!, "Updated repair ticket status", `${task.id} -> ${req.body.status}`);

    res.json(updated);
  })
);

// Technician (or admin) submits completion notes/remarks and marks the job done.
router.post(
  "/:id/complete",
  requireAuth,
  validateBody(taskCompletionSchema),
  asyncHandler(async (req, res) => {
    const [task] = await db.select().from(repairTasks).where(eq(repairTasks.id, req.params.id));
    if (!task) throw notFound("Repair task");

    if (req.user!.role !== "ADMIN" && task.assignedTechnicianId !== req.user!.technicianId) {
      throw new ApiError(403, "You are not assigned to this task");
    }

    const [updated] = await db
      .update(repairTasks)
      .set({
        ...req.body,
        status: "Completed",
        completionDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date(),
      })
      .where(eq(repairTasks.id, req.params.id))
      .returning();

    await db.insert(customerTimelineEvents).values({
      id: ids.timelineEvent(),
      customerId: task.customerId,
      action: "Repair Task Completed",
      description: `Task ${task.id} marked complete: ${req.body.workPerformed}`,
    });

    await recordActivity(req.user!, "Completed field service ticket", task.id);

    res.json(updated);
  })
);

// Technician (or admin) adds a free-text remark to a task's timeline without
// necessarily marking it complete - "Add notes or repair remarks".
router.post(
  "/:id/notes",
  requireAuth,
  validateBody(taskNoteSchema),
  asyncHandler(async (req, res) => {
    const [task] = await db.select().from(repairTasks).where(eq(repairTasks.id, req.params.id));
    if (!task) throw notFound("Repair task");

    if (req.user!.role !== "ADMIN" && task.assignedTechnicianId !== req.user!.technicianId) {
      throw new ApiError(403, "You are not assigned to this task");
    }

    const [event] = await db
      .insert(customerTimelineEvents)
      .values({
        id: ids.timelineEvent(),
        customerId: task.customerId,
        action: "Technician Note",
        description: `[Task ${task.id}] ${req.body.note}`,
      })
      .returning();

    res.status(201).json(event);
  })
);

// Task history for a given customer - "view task history".
router.get(
  "/history/:customerId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(repairTasks)
      .where(eq(repairTasks.customerId, req.params.customerId));

    if (req.user!.role !== "ADMIN") {
      return res.json(rows.filter((r) => r.assignedTechnicianId === req.user!.technicianId));
    }
    res.json(rows);
  })
);

export default router;
