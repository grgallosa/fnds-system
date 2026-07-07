import { Router } from "express";
import { sql, eq, and } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { invoices, customers } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { todayStr } from "../utils/billing.ts";

const router = Router();

// Note: a server-computed `/summary` endpoint used to live here, but it was
// never called by the frontend - DashboardTab.tsx independently recomputes
// the same metrics (revenue, net income, outstanding balance) client-side
// from state.invoices/state.expenses, and that computation is correct and
// already covers this. Removed rather than keeping two definitions of
// "revenue" that could silently drift (see production readiness audit).

// Dedicated billing dashboard metrics: due today/this week, overdue
// customers, outstanding balance, expected vs. collected monthly revenue.
// Computed in SQL for the same reason as /summary above - real numbers,
// not client-side guesses, and cheap even at thousands of customers.
router.get(
  "/billing-summary",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const today = todayStr();
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const monthPrefix = today.slice(0, 7);

    const [dueToday] = await db
      .select({ count: sql<string>`count(*)` })
      .from(customers)
      .where(and(eq(customers.status, "Active"), eq(customers.nextDueDate, today)));

    const [dueThisWeek] = await db
      .select({ count: sql<string>`count(*)` })
      .from(customers)
      .where(
        and(
          eq(customers.status, "Active"),
          sql`${customers.nextDueDate} >= ${today}`,
          sql`${customers.nextDueDate} <= ${weekFromNow}`
        )
      );

    const [overdueCustomers] = await db
      .select({ count: sql<string>`count(*)` })
      .from(customers)
      .where(eq(customers.billingStatus, "Overdue"));

    const [outstanding] = await db
      .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)` })
      .from(invoices)
      .where(sql`${invoices.status} in ('Unpaid', 'Overdue')`);

    const [expectedMonthlyRevenue] = await db
      .select({ total: sql<string>`coalesce(sum(${customers.monthlyFee}), 0)` })
      .from(customers)
      .where(eq(customers.status, "Active"));

    const [collectedThisMonth] = await db
      .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)` })
      .from(invoices)
      .where(
        and(eq(invoices.status, "Paid"), sql`${invoices.paymentDate} like ${monthPrefix + "%"}`)
      );

    res.json({
      dueToday: Number(dueToday.count),
      dueThisWeek: Number(dueThisWeek.count),
      overdueCustomers: Number(overdueCustomers.count),
      totalOutstandingBalance: Number(outstanding.total),
      expectedMonthlyRevenue: Number(expectedMonthlyRevenue.total),
      collectedRevenueThisMonth: Number(collectedThisMonth.total),
    });
  })
);

export default router;
