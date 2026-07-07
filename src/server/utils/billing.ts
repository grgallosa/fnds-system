/**
 * Pure date/business-rule helpers for the recurring monthly billing system.
 * Kept dependency-free and side-effect-free so the same logic can be unit
 * tested trivially and reused from routes, services, and the scheduler
 * without duplicating date math anywhere.
 *
 * All dates in this module are plain "YYYY-MM-DD" strings (matching how the
 * rest of the schema stores dates), and are treated as UTC calendar dates -
 * there is no time-of-day component to a due date.
 */

/** Days in a given month (1-12), accounting for leap years. */
function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the *next* month is the last day of this month.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function formatDate(year: number, month1to12: number, day: number): string {
  const mm = String(month1to12).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Extracts the recurring due day (1-31) from a billing start date. This is
 * the "day of month" component, used to derive every subsequent due date.
 */
export function deriveDueDay(billingStartDate: string): number {
  return parseDate(billingStartDate).day;
}

/**
 * Adds `months` calendar months to `dateStr`, then clamps the result to the
 * target due day - rolling short months (e.g. Feb) to their last valid day
 * instead of overflowing into the next month.
 *
 * Example: billed on the 31st -> Feb result clamps to Feb 28 (or 29).
 * The following month then correctly rolls back to the 31st if that month
 * has 31 days, because we always clamp against `dueDay`, not against
 * whatever the previous (possibly-clamped) day happened to be.
 */
export function addMonthsClamped(
  dateStr: string,
  months: number,
  dueDay: number
): string {
  const { year, month } = parseDate(dateStr);
  const totalMonths = year * 12 + (month - 1) + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(dueDay, daysInMonth(newYear, newMonth));
  return formatDate(newYear, newMonth, clampedDay);
}

/**
 * Computes the next due date after `fromDueDate`, respecting the customer's
 * recurring due day and clamping for short months.
 */
export function computeNextDueDate(fromDueDate: string, dueDay: number): string {
  return addMonthsClamped(fromDueDate, 1, dueDay);
}

/**
 * The billing period a monthly invoice covers: the one calendar month
 * ending the day before its due date (an ISP bill "for July" that becomes
 * due August 1, say). For a customer's very first invoice, the period
 * starts on their billing start date itself.
 */
export function computeBillingPeriod(
  dueDate: string,
  dueDay: number,
  isFirstInvoice: boolean,
  billingStartDate: string
): { billingPeriodStart: string; billingPeriodEnd: string } {
  if (isFirstInvoice) {
    return { billingPeriodStart: billingStartDate, billingPeriodEnd: dueDate };
  }
  const { year, month } = parseDate(dueDate);
  const totalMonths = year * 12 + (month - 1) - 1;
  const prevYear = Math.floor(totalMonths / 12);
  const prevMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(dueDay, daysInMonth(prevYear, prevMonth));
  const billingPeriodStart = formatDate(prevYear, prevMonth, clampedDay);
  return { billingPeriodStart, billingPeriodEnd: dueDate };
}

/** Whole days between two YYYY-MM-DD dates (b - a). Can be negative. */
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(da.year, da.month - 1, da.day);
  const utcB = Date.UTC(db.year, db.month - 1, db.day);
  return Math.round((utcB - utcA) / msPerDay);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Number of days out that counts as "Due Soon" (inclusive). */
export const DUE_SOON_WINDOW_DAYS = 7;

/**
 * Rolls up a customer's billing standing from their nextDueDate:
 *  - Overdue: next due date has already passed
 *  - Due Soon: next due date is within DUE_SOON_WINDOW_DAYS
 *  - Current: everything else
 */
export function computeBillingStatus(
  nextDueDate: string,
  today: string = todayStr()
): "Current" | "Due Soon" | "Overdue" {
  const diff = daysBetween(today, nextDueDate); // nextDueDate - today
  if (diff < 0) return "Overdue";
  if (diff <= DUE_SOON_WINDOW_DAYS) return "Due Soon";
  return "Current";
}

/** Formats a Date/now as YYYY-MM-DD, used consistently for created invoices. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
