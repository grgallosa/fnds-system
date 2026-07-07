import React, { useState } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Wrench,
  CheckCircle,
  ArrowUpRight,
  TrendingDown,
  ShoppingBag,
  Plus,
  Zap,
  Clock,
  CalendarClock,
  CalendarDays,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { AppState, Customer, Invoice, Expense, RepairTask, ActivityLog } from "../types";
import { BillingSummary } from "../hooks/useAppData";

interface DashboardTabProps {
  state: AppState;
  billingSummary?: BillingSummary | null;
  onNavigateToTab: (tab: string) => void;
  onOpenCustomer: (id: string) => void;
  onOpenTask: (id: string) => void;
}

export default function DashboardTab({
  state,
  billingSummary,
  onNavigateToTab,
  onOpenCustomer,
  onOpenTask,
}: DashboardTabProps) {
  const [hoveredRevenueBar, setHoveredRevenueBar] = useState<number | null>(null);
  const [hoveredExpenseSlice, setHoveredExpenseSlice] = useState<string | null>(null);

  // Live date anchors - previously hardcoded to "2026-06"/"2026-07-05", which
  // meant these numbers would have quietly gone stale the moment real time
  // moved past that fixed date.
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentMonthPrefix = now.toISOString().slice(0, 7); // e.g. "2026-07"
  const currentMonthName = now.toLocaleString("en-US", { month: "long" });

  // Last 5 months (incl. current, "MTD") of real paid revenue - replaces the
  // old chart which had 4 of its 5 bars/tooltips hardcoded to fixed numbers
  // and a fixed "Jul (MTD)" label that would have gone stale after July 2026.
  const monthlyRevenueTrend = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    const prefix = d.toISOString().slice(0, 7);
    const isCurrent = i === 4;
    const total = state.invoices
      .filter((inv) => inv.status === "Paid" && inv.dueDate.startsWith(prefix))
      .reduce((sum, inv) => sum + inv.amount, 0);
    return {
      label: d.toLocaleString("en-US", { month: "short" }) + (isCurrent ? " (MTD)" : ""),
      total,
    };
  });
  const revenueAxisMax = Math.max(
    250,
    Math.ceil(Math.max(...monthlyRevenueTrend.map((m) => m.total), 1) / 250) * 250
  );

  // Colors for donut chart
  const COLORS = ["#1A73E8", "#34A853", "#FBBC05", "#EA4335", "#8E24AA", "#00ACC1", "#F4511E", "#795548"];


  // Real expense breakdown by category - replaces the old donut chart, which
  // was 100% hardcoded fake categories (Salaries/Backbone/Hardware/Other)
  // with fixed percentages disconnected from actual recorded expenses.
  const expenseCategoryTotals = state.expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedExpenseCategories = Object.entries(expenseCategoryTotals).sort((a, b) => b[1] - a[1]);
  const topExpenseCategories = sortedExpenseCategories.slice(0, 3);
  const otherExpenseTotal = sortedExpenseCategories.slice(3).reduce((sum, [, v]) => sum + v, 0);
  const expenseDonutSlices = [
    ...topExpenseCategories.map(([name, total]) => ({ name, total })),
    ...(otherExpenseTotal > 0 ? [{ name: "Other", total: otherExpenseTotal }] : []),
  ];
  const expenseDonutTotal = expenseDonutSlices.reduce((sum, s) => sum + s.total, 0) || 1;
  let expenseCumulativePct = 0;
  const expenseDonutGeometry = expenseDonutSlices.map((slice, i) => {
    const pct = (slice.total / expenseDonutTotal) * 100;
    const dashoffset = -expenseCumulativePct;
    expenseCumulativePct += pct;
    return { ...slice, pct, dashoffset, color: COLORS[i % COLORS.length] };
  });

  // 1. Compute dynamic metrics
  const totalCustomers = state.customers.length;
  const activeCustomers = state.customers.filter((c) => c.status === "Active").length;
  const suspendedCustomers = state.customers.filter((c) => c.status === "Suspended").length;

  // Paid invoices count as dynamic revenue
  const totalPaidRevenue = state.invoices
    .filter((inv) => inv.status === "Paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Monthly revenue for the current month
  const junePaidRevenue = state.invoices
    .filter((inv) => inv.status === "Paid" && inv.dueDate.startsWith(currentMonthPrefix))
    .reduce((sum, inv) => sum + inv.amount, 0);

  const outstandingBalance = state.invoices
    .filter((inv) => inv.status === "Unpaid" || inv.status === "Overdue")
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Total expenses
  const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Current month expenses
  const juneExpenses = state.expenses
    .filter((exp) => exp.date.startsWith(currentMonthPrefix))
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Net Profit
  const netProfit = totalPaidRevenue - totalExpenses;
  const juneNetProfit = junePaidRevenue - juneExpenses;

  // Technician Tasks metrics
  const totalTasks = state.tasks.length;
  const openTasks = state.tasks.filter(
    (t) => t.status !== "Completed" && t.status !== "Cancelled"
  ).length;
  const completedTodayCount = state.tasks.filter(
    (t) => t.status === "Completed" && t.completionDate === todayStr
  ).length;

  // 2. Chart calculations
  // Customer growth over the last 6 calendar months (rolling, not hardcoded)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toISOString().slice(0, 7);
  });
  const customerGrowthData = months.map((m) => {
    const count = state.customers.filter((c) => c.installationDate.startsWith(m)).length;
    return { month: m, count };
  });

  // Expense breakdown by Category
  const expenseCategories: { [key: string]: number } = {};
  state.expenses.forEach((e) => {
    expenseCategories[e.category] = (expenseCategories[e.category] || 0) + e.amount;
  });
  const expenseBreakdown = Object.keys(expenseCategories).map((cat) => ({
    category: cat,
    amount: expenseCategories[cat],
  })).sort((a, b) => b.amount - a.amount);

  // Total invoice collections summary
  const collectionRate =
    totalPaidRevenue + outstandingBalance > 0
      ? (totalPaidRevenue / (totalPaidRevenue + outstandingBalance)) * 100
      : 0;

  // Recurring billing snapshot: prefer the server-computed summary (exact,
  // SQL-aggregated), but fall back to a client-side estimate from already-
  // loaded state so the cards aren't empty on first paint.
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fallbackBillingSummary: BillingSummary = {
    dueToday: state.customers.filter((c) => c.status === "Active" && c.nextDueDate === todayStr).length,
    dueThisWeek: state.customers.filter(
      (c) => c.status === "Active" && c.nextDueDate >= todayStr && c.nextDueDate <= weekFromNow
    ).length,
    overdueCustomers: state.customers.filter((c) => c.billingStatus === "Overdue").length,
    totalOutstandingBalance: outstandingBalance,
    expectedMonthlyRevenue: state.customers
      .filter((c) => c.status === "Active")
      .reduce((sum, c) => sum + c.monthlyFee, 0),
    collectedRevenueThisMonth: junePaidRevenue,
  };
  const billing = billingSummary || fallbackBillingSummary;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Business Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time operations, billing, technician progress, and business reporting summaries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 flex items-center gap-1.5 border border-blue-500/20">
            <Zap className="h-4 w-4 text-blue-400 animate-pulse" />
            Active Symmetrical SLA: 99.98%
          </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Customers */}
        <div
          onClick={() => onNavigateToTab("customers")}
          className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0c1222]/60 p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-[#0c1222]/90 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Customers</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-white">
              {totalCustomers}
            </span>
            <span className="text-xs text-slate-500">total</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold text-green-400">
              {activeCustomers} Active
            </span>
            <span>•</span>
            <span className="text-orange-400 font-medium">
              {suspendedCustomers} Suspended
            </span>
          </div>
        </div>

        {/* Total Revenue */}
        <div
          onClick={() => onNavigateToTab("billing")}
          className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0c1222]/60 p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-green-500/30 hover:bg-[#0c1222]/90 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Collected Income</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-400 transition-colors group-hover:bg-green-600 group-hover:text-white">
              <span className="font-bold text-sm">₱</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-lg font-semibold text-white">
              ₱{totalPaidRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold text-green-400 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              {collectionRate.toFixed(1)}% Collection Rate
            </span>
          </div>
        </div>

        {/* Total Expenses */}
        <div
          onClick={() => onNavigateToTab("expenses")}
          className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0c1222]/60 p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-red-500/30 hover:bg-[#0c1222]/90 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Expenses</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 transition-colors group-hover:bg-red-600 group-hover:text-white">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-lg font-semibold text-white">
              ₱{totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-red-400 font-semibold">
              ₱{juneExpenses.toFixed(0)} spent in {currentMonthName}
            </span>
          </div>
        </div>

        {/* Net Profit */}
        <div
          className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0c1222]/60 p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-purple-500/30 hover:bg-[#0c1222]/90"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Net Profit</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className={`text-lg font-semibold ${netProfit >= 0 ? "text-white" : "text-red-400"}`}>
              ₱{netProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-purple-400 font-semibold">
              Margin: {((netProfit / (totalPaidRevenue || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Outstanding Receivables */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Outstanding Balance
            </span>
            <h3 className="text-lg font-bold text-slate-100 mt-0.5">
              ₱{outstandingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-xxs text-slate-500 mt-0.5">Active invoice collections</p>
          </div>
        </div>

        {/* Open Repair Tasks */}
        <div
          onClick={() => onNavigateToTab("tasks")}
          className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm hover:border-blue-500/30 cursor-pointer transition-colors"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Repair Tasks
            </span>
            <h3 className="text-lg font-bold text-slate-100 mt-0.5">{openTasks} Open</h3>
            <p className="text-xxs text-slate-500 mt-0.5">Assigned and active field repairs</p>
          </div>
        </div>

        {/* Completed Repairs Today */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Completed Repairs Today
            </span>
            <h3 className="text-lg font-bold text-slate-100 mt-0.5">
              {completedTodayCount} Resolved
            </h3>
            <p className="text-xxs text-slate-500 mt-0.5">Technician field actions completed today</p>
          </div>
        </div>
      </div>

      {/* Recurring Billing Snapshot */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recurring Billing</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div
            onClick={() => onNavigateToTab("customers")}
            className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-4 shadow-sm cursor-pointer hover:border-yellow-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Due Today
              </span>
              <CalendarClock className="h-4 w-4 text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-2">{billing.dueToday}</h3>
            <p className="text-xxs text-slate-500 mt-1">Subscribers billed today</p>
          </div>

          <div
            onClick={() => onNavigateToTab("customers")}
            className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-4 shadow-sm cursor-pointer hover:border-yellow-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Due This Week
              </span>
              <CalendarDays className="h-4 w-4 text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-2">{billing.dueThisWeek}</h3>
            <p className="text-xxs text-slate-500 mt-1">Next 7 days</p>
          </div>

          <div
            onClick={() => onNavigateToTab("customers")}
            className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-4 shadow-sm cursor-pointer hover:border-red-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Overdue Customers
              </span>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-2">{billing.overdueCustomers}</h3>
            <p className="text-xxs text-slate-500 mt-1">Past their due date</p>
          </div>

          <div
            onClick={() => onNavigateToTab("billing")}
            className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-4 shadow-sm cursor-pointer hover:border-orange-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Outstanding Balance
              </span>
              <Wallet className="h-4 w-4 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-2">
              ₱{billing.totalOutstandingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-xxs text-slate-500 mt-1">Unpaid + overdue invoices</p>
          </div>

          <div
            onClick={() => onNavigateToTab("billing")}
            className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-4 shadow-sm cursor-pointer hover:border-blue-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Expected Monthly Revenue
              </span>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-2">
              ₱{billing.expectedMonthlyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-xxs text-slate-500 mt-1">Sum of active subscriber fees</p>
          </div>

          <div
            onClick={() => onNavigateToTab("billing")}
            className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-4 shadow-sm cursor-pointer hover:border-green-500/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Collected This Month
              </span>
              <DollarSign className="h-4 w-4 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-2">
              ₱{billing.collectedRevenueThisMonth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-xxs text-slate-500 mt-1">Payments received {currentMonthName}</p>
          </div>
        </div>
      </div>

      {/* Visual Charts section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Line Chart: Revenue Trend (4 Months back to now) */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Monthly Billing Revenue (₱)
              </h3>
              <p className="text-xxs text-slate-500 mt-0.5">Revenue collections timeline</p>
            </div>
            <div className="flex items-center gap-1 text-xxs text-slate-400 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Paid Collections
            </div>
          </div>

          {/* SVG Line / Bar Chart Combined */}
          <div className="relative mt-6 h-64 w-full flex items-end">
            {/* Custom Interactive SVG Graph */}
            <svg viewBox="0 0 500 220" className="h-full w-full">
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="170" x2="480" y2="170" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="40" y1="190" x2="480" y2="190" stroke="#334155" strokeWidth="1.5" />

              {/* Revenue bars - heights/labels computed from real paid invoices */}
              {monthlyRevenueTrend.map((month, i) => {
                const barX = 80 + i * 80;
                const barHeight = Math.round((month.total / revenueAxisMax) * 170);
                const barY = 190 - barHeight;
                const isCurrent = i === monthlyRevenueTrend.length - 1;
                return (
                  <rect
                    key={month.label}
                    x={barX}
                    y={barY}
                    width="35"
                    height={Math.max(barHeight, 1)}
                    rx="6"
                    fill={
                      hoveredRevenueBar === i ? "#3b82f6" : isCurrent ? "#2e3b56" : "#1e293b"
                    }
                    onMouseEnter={() => setHoveredRevenueBar(i)}
                    onMouseLeave={() => setHoveredRevenueBar(null)}
                    className="transition-colors duration-200 cursor-pointer"
                  />
                );
              })}

              {/* Labels */}
              {monthlyRevenueTrend.map((month, i) => (
                <text
                  key={month.label}
                  x={97 + i * 80}
                  y="208"
                  textAnchor="middle"
                  className="text-[10px] font-medium fill-slate-400"
                >
                  {month.label}
                </text>
              ))}

              {/* Value indicators */}
              <text x="40" y="193" textAnchor="end" className="text-[9px] fill-slate-500 font-mono">0</text>
              <text x="40" y="123" textAnchor="end" className="text-[9px] fill-slate-500 font-mono">{Math.round(revenueAxisMax / 3).toLocaleString()}</text>
              <text x="40" y="73" textAnchor="end" className="text-[9px] fill-slate-500 font-mono">{Math.round((revenueAxisMax / 3) * 2).toLocaleString()}</text>
              <text x="40" y="23" textAnchor="end" className="text-[9px] fill-slate-500 font-mono">{revenueAxisMax.toLocaleString()}</text>

              {/* Tooltip render on svg */}
              {hoveredRevenueBar !== null && (
                <g>
                  {/* Tooltip Background */}
                  <rect
                    x={hoveredRevenueBar * 80 + 55}
                    y={10}
                    width="95"
                    height="28"
                    rx="4"
                    fill="#1e293b"
                    className="opacity-95 stroke stroke-slate-700"
                  />
                  <text
                    x={hoveredRevenueBar * 80 + 102}
                    y={27}
                    textAnchor="middle"
                    fill="#ffffff"
                    className="text-[10px] font-mono font-bold"
                  >
                    {`${monthlyRevenueTrend[hoveredRevenueBar].label}: ₱${monthlyRevenueTrend[hoveredRevenueBar].total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Donut Chart: Expense Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="border-b border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Expense Breakdown
            </h3>
            <p className="text-xxs text-slate-500 mt-0.5">Top expenditure categories</p>
          </div>

          <div className="relative mt-6 flex flex-col items-center justify-center">
            {/* Simple Responsive SVG Pie Chart / Ring */}
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#131b2e" strokeWidth="3" />

                {expenseDonutGeometry.map((slice) => (
                  <circle
                    key={slice.name}
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="3.2"
                    strokeDasharray={`${slice.pct} ${100 - slice.pct}`}
                    strokeDashoffset={slice.dashoffset}
                    className="cursor-pointer transition-all duration-200 hover:stroke-[4]"
                    onMouseEnter={() => setHoveredExpenseSlice(slice.name)}
                    onMouseLeave={() => setHoveredExpenseSlice(null)}
                  />
                ))}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xxs font-semibold uppercase tracking-wider text-slate-500">
                  {hoveredExpenseSlice || "Total"}
                </span>
                <span className="text-base font-bold text-slate-200">
                  {hoveredExpenseSlice
                    ? `${Math.round(
                        expenseDonutGeometry.find((s) => s.name === hoveredExpenseSlice)?.pct ?? 0
                      )}%`
                    : `₱${totalExpenses.toFixed(0)}`}
                </span>
              </div>
            </div>

            {/* Legend Indicators */}
            <div className="mt-5 w-full space-y-2 text-xs">
              {expenseDonutGeometry.length === 0 && (
                <p className="text-center text-slate-500 text-xxs py-2">No expenses recorded yet.</p>
              )}
              {expenseDonutGeometry.map((slice) => (
                <div className="flex items-center justify-between" key={slice.name}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="text-slate-400">{slice.name}</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-300">
                    ₱{slice.total.toLocaleString("en-US", { maximumFractionDigits: 0 })} ({Math.round(slice.pct)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tri-Column Recent Operations Ledger */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Payments column */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Recent Payments
            </h3>
            <button
              onClick={() => onNavigateToTab("billing")}
              className="text-xxs font-semibold text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {state.invoices
              .filter((inv) => inv.status === "Paid")
              .slice(0, 4)
              .map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onOpenCustomer(inv.customerId)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-400 font-semibold text-xs">
                      ₱
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">
                        {inv.customerName}
                      </h4>
                      <p className="text-xxs text-slate-400 mt-0.5">
                        {inv.invoiceNumber} • {inv.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-green-400 font-mono">
                      +₱{inv.amount.toFixed(2)}
                    </span>
                    <p className="text-xxs text-slate-500 mt-0.5">
                      {inv.paymentDate}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Company Expenses Column */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Recent Expenses
            </h3>
            <button
              onClick={() => onNavigateToTab("expenses")}
              className="text-xxs font-semibold text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {state.expenses.slice(0, 4).map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400 font-semibold text-xs">
                    In
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      {exp.category}
                    </h4>
                    <p className="text-xxs text-slate-400 mt-0.5">
                      {exp.vendor}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-red-400 font-mono">
                    -₱{exp.amount.toFixed(2)}
                  </span>
                  <p className="text-xxs text-slate-500 mt-0.5">{exp.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Technician Repairs Column */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Recent Repair Actions
            </h3>
            <button
              onClick={() => onNavigateToTab("tasks")}
              className="text-xxs font-semibold text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {state.tasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg font-semibold text-xs ${
                    task.status === "Completed"
                      ? "bg-green-500/10 text-green-400"
                      : task.status === "In Progress"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-orange-500/10 text-orange-400"
                  }`}>
                    W
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      {task.customerName}
                    </h4>
                    <p className="text-xxs text-slate-400 mt-0.5">
                      {task.id} • {task.priority} Priority
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xxs font-semibold ${
                    task.status === "Completed"
                      ? "bg-green-500/15 text-green-400"
                      : task.status === "In Progress"
                      ? "bg-blue-500/15 text-blue-400"
                      : "bg-yellow-500/15 text-yellow-400"
                  }`}>
                    {task.status}
                  </span>
                  <p className="text-xxs text-slate-500 mt-0.5">
                    {task.scheduledDate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
