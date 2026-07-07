import { Router } from "express";
import { sql, eq, and } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { invoices, expenses, customers, repairTasks } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { todayStr } from "../utils/billing.ts";

const router = Router();

// Real aggregates computed in SQL, not guessed/hardcoded on the client.
router.get(
  "/summary",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [revenue] = await db
      .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)` })
      .from(invoices)
      .where(eq(invoices.status, "Paid"));

    const [pending] = await db
      .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)` })
      .from(invoices)
      .where(eq(invoices.status, "Unpaid"));

    const [overdue] = await db
      .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)` })
      .from(invoices)
      .where(eq(invoices.status, "Overdue"));

    const [expenseTotal] = await db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses);

    const [customerCount] = await db
      .select({ count: sql<string>`count(*)` })
      .from(customers)
      .where(eq(customers.status, "Active"));

    const [openTasks] = await db
      .select({ count: sql<string>`count(*)` })
      .from(repairTasks)
      .where(sql`${repairTasks.status} not in ('Completed', 'Cancelled')`);

    res.json({
      totalRevenue: Number(revenue.total),
      pendingRevenue: Number(pending.total),
      overdueRevenue: Number(overdue.total),
      totalExpenses: Number(expenseTotal.total),
      netIncome: Number(revenue.total) - Number(expenseTotal.total),
      activeCustomers: Number(customerCount.count),
      openTasks: Number(openTasks.count),
    });
  })
);

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
