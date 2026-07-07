import { randomBytes } from "crypto";

/**
 * Generates prefixed, human-readable IDs consistent with the existing data
 * shape (e.g. CUST-1001, TASK-1001) without relying on client-supplied IDs
 * or a fragile Date.now() suffix that can collide under concurrent writes.
 */
function randomSuffix(length: number): string {
  return randomBytes(length)
    .toString("hex")
    .toUpperCase()
    .slice(0, length);
}

export function generateId(prefix: string): string {
  const timePart = Date.now().toString(36).toUpperCase().slice(-6);
  const randPart = randomSuffix(4);
  return `${prefix}-${timePart}${randPart}`;
}

export const ids = {
  user: () => generateId("USR"),
  customer: () => generateId("CUST"),
  plan: () => generateId("PLAN"),
  invoice: () => `INV-${new Date().getFullYear()}-${randomSuffix(6)}`,
  payment: () => generateId("PAY"),
  expense: () => generateId("EXP"),
  technician: () => generateId("TECH"),
  task: () => generateId("TASK"),
  timelineEvent: () => generateId("TL"),
  log: () => generateId("LOG"),
  audit: () => generateId("AUD"),
  notification: () => generateId("NOT"),
};
