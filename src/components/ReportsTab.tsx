import React, { useState } from "react";
import {
  FileBarChart2,
  Download,
  Printer,
  Table,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wrench,
  Users,
  CheckCircle,
  FileCheck2,
  ArrowUpRight
} from "lucide-react";
import { AppState } from "../types";

interface ReportsTabProps {
  state: AppState;
}

type ReportType =
  | "financial"
  | "outstanding"
  | "customer_growth"
  | "tech_performance"
  | "repairs_completed";

export default function ReportsTab({ state }: ReportsTabProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>("financial");
  const [exporting, setExporting] = useState<string | null>(null);

  // 1. Calculations
  const invoices = state.invoices;
  const customers = state.customers;
  const expenses = state.expenses;
  const tasks = state.tasks;
  const technicians = state.technicians;

  // Paid Revenue
  const totalPaidRevenue = invoices
    .filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + i.amount, 0);

  // Total Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Profit
  const netProfit = totalPaidRevenue - totalExpenses;

  // Outstanding Receivables
  const outstandingAmount = invoices
    .filter((i) => i.status === "Unpaid" || i.status === "Overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  // Real expense-by-category breakdown for the Financial Flow Statements
  // table below - previously this table showed fabricated line items
  // (fixed category names/amounts) that didn't even sum to totalExpenses.
  const expensesByCategory = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  // Simulation Export triggers
  const handleExport = (format: string) => {
    setExporting(format);
    setTimeout(() => {
      setExporting(null);
      alert(`Report successfully compiled and exported as optifiber_${selectedReport}_report.${format.toLowerCase()}`);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5 text-blue-400" />
            Corporate Reporting Suite
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit operational key performance metrics, compile financial state ledgers, and download CSV/Excel/PDF schedules.
          </p>
        </div>

        {/* Quick Export Tools */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => handleExport("CSV")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            CSV
          </button>
          <button
            onClick={() => handleExport("XLSX")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Excel
          </button>
          <button
            onClick={() => handleExport("PDF")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            Print
          </button>
        </div>
      </div>

      {exporting && (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/25 p-3 text-xs font-semibold text-blue-400 flex items-center gap-2 animate-pulse">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
          Compiling ledger records and exporting as {exporting} format, please wait...
        </div>
      )}

      {/* Report Switcher Bento Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left selector menu */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/20 p-4 shadow-sm space-y-1.5 lg:col-span-1">
          <span className="text-xxs font-bold text-slate-500 uppercase tracking-widest block px-3 mb-2.5">
            Select Report Type
          </span>

          <button
            onClick={() => setSelectedReport("financial")}
            className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              selectedReport === "financial"
                ? "bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold shadow-xs"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            }`}
          >
            <DollarSign className="h-4 w-4 shrink-0" />
            Monthly Financial Summary
          </button>

          <button
            onClick={() => setSelectedReport("outstanding")}
            className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              selectedReport === "outstanding"
                ? "bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold shadow-xs"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            }`}
          >
            <Table className="h-4 w-4 shrink-0" />
            Outstanding Receivables
          </button>

          <button
            onClick={() => setSelectedReport("customer_growth")}
            className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              selectedReport === "customer_growth"
                ? "bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold shadow-xs"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            Customer Growth Timeline
          </button>

          <button
            onClick={() => setSelectedReport("tech_performance")}
            className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              selectedReport === "tech_performance"
                ? "bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold shadow-xs"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            }`}
          >
            <FileCheck2 className="h-4 w-4 shrink-0" />
            Technician Performance
          </button>

          <button
            onClick={() => setSelectedReport("repairs_completed")}
            className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              selectedReport === "repairs_completed"
                ? "bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold shadow-xs"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            }`}
          >
            <Wrench className="h-4 w-4 shrink-0" />
            Repairs & Resolution Logs
          </button>
        </div>

        {/* Right Report Display Canvas Sheet */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/35 p-6 shadow-sm lg:col-span-3 min-h-128 flex flex-col justify-between">
          <div>
            {/* Sheet Title */}
            <div className="border-b border-slate-800 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-black text-slate-100 uppercase tracking-wider leading-snug">
                  {selectedReport === "financial" && "Monthly Financial Balance Summary"}
                  {selectedReport === "outstanding" && "Outstanding Receivables & Due Billing Bills"}
                  {selectedReport === "customer_growth" && "Customer Registrations Growth Schedule"}
                  {selectedReport === "tech_performance" && "Technician Restoration Efficiency Summary"}
                  {selectedReport === "repairs_completed" && "Field Repair Resolution Activity Report"}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Report generated on July 5, 2026 • Scope: Complete Historical Database
                </p>
              </div>
              <span className="rounded-full bg-blue-500/15 border border-blue-500/20 px-3 py-1 text-xxs font-bold text-blue-400 uppercase tracking-widest shrink-0">
                Active Audit
              </span>
            </div>

            {/* Render selected report content */}
            <div className="mt-6 space-y-6">
              {/* Report 1: Financial profit calculation */}
              {selectedReport === "financial" && (
                <div className="space-y-6">
                  {/* Ledger Metrics Box */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Collected Billings</span>
                      <span className="text-lg font-bold text-green-400 block mt-1">₱{totalPaidRevenue.toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Operational Expenses</span>
                      <span className="text-lg font-bold text-red-400 block mt-1">₱{totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Net Balance Profit</span>
                      <span className="text-lg font-black text-blue-400 block mt-1">₱{netProfit.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Financial breakdown subtable */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Financial Flow Statements</h3>
                    <div className="border border-slate-800/85 rounded-xl overflow-hidden text-xs bg-[#0c1222]/10">
                      <div className="grid grid-cols-3 bg-slate-900/60 font-bold text-slate-400 border-b border-slate-800 p-2.5">
                        <span>Ledger Category</span>
                        <span>Type</span>
                        <span className="text-right">Aggregate (₱)</span>
                      </div>
                      <div className="divide-y divide-slate-800/60">
                        <div className="grid grid-cols-3 p-2.5 hover:bg-slate-900/20">
                          <span className="text-slate-300">Fiber Broadband Subscriptions</span>
                          <span className="text-green-400 font-semibold">Income</span>
                          <span className="text-right font-mono text-slate-300">₱{totalPaidRevenue.toFixed(2)}</span>
                        </div>
                        {expensesByCategory.length === 0 && (
                          <div className="grid grid-cols-3 p-2.5">
                            <span className="text-slate-500 col-span-3 text-center italic">No expenses recorded yet.</span>
                          </div>
                        )}
                        {expensesByCategory.map(([category, total]) => (
                          <div className="grid grid-cols-3 p-2.5 hover:bg-slate-900/20" key={category}>
                            <span className="text-slate-300">{category}</span>
                            <span className="text-red-400 font-semibold">Expense</span>
                            <span className="text-right font-mono text-slate-300">₱{total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Report 2: Outstanding Receivables */}
              {selectedReport === "outstanding" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-4 text-xs text-orange-300 leading-relaxed">
                    <strong>Notice:</strong> Outstanding receivables represents fiber accounts that are currently overdue or pending payment. Action must be taken to issue notices or auto-suspend when bills exceed 15 overdue days.
                  </div>

                  <div className="border border-slate-800/85 rounded-xl overflow-hidden text-xs bg-[#0c1222]/10">
                    <div className="grid grid-cols-4 bg-slate-900/60 font-bold text-slate-400 border-b border-slate-800 p-2.5">
                      <span>Invoice ID</span>
                      <span>Customer</span>
                      <span>Due Date</span>
                      <span className="text-right">Balance Due (₱)</span>
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      {invoices
                        .filter((i) => i.status === "Unpaid" || i.status === "Overdue")
                        .map((inv) => (
                          <div key={inv.id} className="grid grid-cols-4 p-2.5 hover:bg-slate-900/20">
                            <span className="font-mono font-bold text-slate-400">{inv.invoiceNumber}</span>
                            <span className="text-slate-300">{inv.customerName}</span>
                            <span className="text-red-400 font-medium">{inv.dueDate}</span>
                            <span className="text-right font-mono font-semibold text-slate-300">₱{inv.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      <div className="grid grid-cols-4 p-2.5 bg-slate-900/40 font-bold text-slate-300">
                        <span className="col-span-3">Total Outstanding Receivables:</span>
                        <span className="text-right font-mono text-orange-400">₱{outstandingAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Report 3: Customer Growth */}
              {selectedReport === "customer_growth" && (
                <div className="space-y-4">
                  <div className="border border-slate-800/85 rounded-xl overflow-hidden text-xs bg-[#0c1222]/10">
                    <div className="grid grid-cols-4 bg-slate-900/60 font-bold text-slate-400 border-b border-slate-800 p-2.5">
                      <span>Subscriber ID</span>
                      <span>Full Name</span>
                      <span>Installation Date</span>
                      <span className="text-right">Status</span>
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      {customers.map((cust) => (
                        <div key={cust.id} className="grid grid-cols-4 p-2.5 hover:bg-slate-900/20">
                          <span className="font-mono text-slate-500">{cust.id}</span>
                          <span className="font-semibold text-slate-200">{cust.fullName}</span>
                          <span className="text-slate-300">{cust.installationDate}</span>
                          <span className="text-right font-semibold text-green-400">
                            {cust.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Report 4: Technician Efficiency */}
              {selectedReport === "tech_performance" && (
                <div className="space-y-4">
                  <div className="border border-slate-800/85 rounded-xl overflow-hidden text-xs bg-[#0c1222]/10">
                    <div className="grid grid-cols-5 bg-slate-900/60 font-bold text-slate-400 border-b border-slate-800 p-2.5">
                      <span>Employee ID</span>
                      <span>Name</span>
                      <span>Work Order Tickets</span>
                      <span>Completed Repairs</span>
                      <span className="text-right">Resolution Ratio</span>
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      {technicians.map((tech) => {
                        const techTasks = tasks.filter((t) => t.assignedTechnicianId === tech.id);
                        const completed = techTasks.filter((t) => t.status === "Completed").length;
                        const ratio = techTasks.length > 0 ? (completed / techTasks.length) * 100 : 100;
                        return (
                          <div key={tech.id} className="grid grid-cols-5 p-2.5 hover:bg-slate-900/20">
                            <span className="font-mono text-slate-500">{tech.id}</span>
                            <span className="font-semibold text-slate-200">{tech.name}</span>
                            <span className="text-slate-300">{techTasks.length} Assigned</span>
                            <span className="text-slate-300">{completed} Closed</span>
                            <span className="text-right font-mono font-semibold text-blue-400">{ratio.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Report 5: Repairs Logs */}
              {selectedReport === "repairs_completed" && (
                <div className="space-y-4">
                  <div className="border border-slate-800/85 rounded-xl overflow-hidden text-xs bg-[#0c1222]/10">
                    <div className="grid grid-cols-4 bg-slate-900/60 font-bold text-slate-400 border-b border-slate-800 p-2.5">
                      <span>Task Number</span>
                      <span>Customer</span>
                      <span>Priority</span>
                      <span className="text-right">Resolution Status</span>
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      {tasks.map((t) => (
                        <div key={t.id} className="grid grid-cols-4 p-2.5 hover:bg-slate-900/20">
                          <span className="font-mono text-slate-500">{t.id}</span>
                          <span className="text-slate-300">{t.customerName}</span>
                          <span className="font-semibold text-slate-300">{t.priority}</span>
                          <span className={`text-right font-semibold ${t.status === "Completed" ? "text-green-400" : "text-yellow-400"}`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sheet Footer details */}
          <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              This document is an authentic generated record of OptiFiber systems.
            </span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
