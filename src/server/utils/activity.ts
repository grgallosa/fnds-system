import { db } from "../../db/index.ts";
import { activityLogs, auditRecords } from "../../db/schema.ts";
import { ids } from "./ids.ts";
import { AuthTokenPayload } from "../auth/tokens.ts";

export async function recordActivity(
  user: AuthTokenPayload,
  action: string,
  affectedRecord: string
) {
  await db.insert(activityLogs).values({
    id: ids.log(),
    userId: user.userId,
    userName: user.username,
    role: user.role === "ADMIN" ? "Administrator" : "Technician",
    action,
    affectedRecord,
  });
}

export async function recordAudit(
  user: AuthTokenPayload,
  action: string,
  previousValue: string,
  newValue: string
) {
  await db.insert(auditRecords).values({
    id: ids.audit(),
    userId: user.userId,
    userName: user.username,
    action,
    previousValue,
    newValue,
  });
}
