import React, { useState } from "react";
import {
  Receipt,
  Search,
  Plus,
  TrendingUp,
  DollarSign,
  AlertOctagon,
  CheckCircle,
  X,
  CreditCard,
  Building,
  Check,
  Calendar,
  Layers,
  Percent,
  RefreshCw,
} from "lucide-react";
import { AppState, Invoice, Customer } from "../types";

interface BillingTabProps {
  state: AppState;
  onAddInvoice: (invoice: Omit<Invoice, "id" | "invoiceNumber">) => void | Promise<void>;
  onRecordPayment: (
    id: string,
    paymentMethod: "Cash" | "Bank Transfer" | "Credit Card" | "Mobile Wallet" | "Other",
    details?: { paymentDate?: string; referenceNumber?: string; notes?: string }
  ) => void | Promise<void>;
  onCancelInvoice: (id: string) => void | Promise<void>;
  onGenerateMonthlyInvoices: () => Promise<number>;
}

export default function BillingTab({
  state,
  onAddInvoice,
  onRecordPayment,
  onCancelInvoice,
  onGenerateMonthlyInvoices,
}: BillingTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isGenerating, setIsGenerating] = useState(false);

  // Record payment state
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState<"Cash" | "Bank Transfer" | "Credit Card" | "Mobile Wallet" | "Other">("Mobile Wallet");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  // Create invoice state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invCustomerId, setInvCustomerId] = useState(state.customers[0]?.id || "");
  const today = new Date();
  const defaultDueDate = new Date(today.getFullYear(), today.getMonth(), 15).toISOString().slice(0, 10);
  const defaultPeriodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [invPeriodStart, setInvPeriodStart] = useState(defaultPeriodStart);
  const [invPeriodEnd, setInvPeriodEnd] = useState(defaultDueDate);
  const [invDueDate, setInvDueDate] = useState(defaultDueDate);
  const [invAmount, setInvAmount] = useState(state.customers[0]?.monthlyFee || 1699);

  const handleGenerateMonthly = async () => {
    setIsGenerating(true);
    try {
      const count = await onGenerateMonthlyInvoices();
      alert(`Generated ${count} invoice(s) for customers whose billing cycle is due.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Sync amount when selecting customer in modal
  const handleCustomerChangeInInvoice = (customerId: string) => {
    setInvCustomerId(customerId);
    const cust = state.customers.find((c) => c.id === customerId);
    if (cust) {
      setInvAmount(cust.monthlyFee);
    }
  };

  // Metrics calculations
  const invoices = state.invoices;
  const activeCount = state.customers.filter((c) => c.status === "Active").length;

  const totalPaidRevenue = invoices
    .filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + i.amount, 0);

  const outstandingBalance = invoices
    .filter((i) => i.status === "Unpaid" || i.status === "Overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  const collectionRate =
    totalPaidRevenue + outstandingBalance > 0
      ? (totalPaidRevenue / (totalPaidRevenue + outstandingBalance)) * 100
      : 0;

  // Revenue collected today
  const todayStr = new Date().toISOString().slice(0, 10);
  const revenueToday = invoices
    .filter((i) => i.status === "Paid" && i.paymentDate === todayStr)
    .reduce((sum, i) => sum + i.amount, 0);

  const averageRevenuePerCustomer =
    activeCount > 0 ? totalPaidRevenue / activeCount : 0;

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invCustomerId) return;

    const customer = state.customers.find((c) => c.id === invCustomerId);
    if (!customer) return;

    try {
      await onAddInvoice({
        customerId: invCustomerId,
        customerName: customer.fullName,
        billingPeriodStart: invPeriodStart,
        billingPeriodEnd: invPeriodEnd,
        dueDate: invDueDate,
        amount: Number(invAmount),
        status: "Unpaid",
      });

      setShowCreateModal(false);
    } catch (err: any) {
      alert(err?.message || "Failed to create invoice.");
    }
  };

  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setIsRecordingPayment(true);
    try {
      await onRecordPayment(selectedInvoice.id, payMethod, {
        paymentDate: payDate,
        referenceNumber: payReference || undefined,
        notes: payNotes || undefined,
      });
      setShowPayModal(false);
      setSelectedInvoice(null);
      setPayReference("");
      setPayNotes("");
    } catch (err: any) {
      alert(err?.message || "Failed to record payment.");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch =
      i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "All" || i.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-400" />
            Billing & Invoices
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Collect subscriber fees, post outstanding balances, and audit payment methods.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateMonthly}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Generate invoices for any customer whose monthly cycle is due (runs automatically every day, too)"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            Run Monthly Billing
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Generate Invoice
          </button>
        </div>
      </div>

      {/* Sales Dashboard Metrics Widgets */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Collections */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Today's Collections
            </span>
            <span className="font-bold text-xs text-green-400">₱</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mt-2">
            ₱{revenueToday.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xxs text-slate-500 mt-1">Real-time collections on Jul 5, 2026</p>
        </div>

        {/* Outstanding Receivables */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding Receivables
            </span>
            <AlertOctagon className="h-4.5 w-4.5 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mt-2">
            ₱{outstandingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xxs text-slate-500 mt-1">Invoices in Unpaid or Overdue states</p>
        </div>

        {/* Collection Rate */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Collection Rate
            </span>
            <Percent className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mt-2">
            {collectionRate.toFixed(1)}%
          </h3>
          <p className="text-xxs text-slate-500 mt-1">Paid ratio against total billings</p>
        </div>

        {/* ARPU (Average Revenue per Customer) */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Avg. Rev per Subscriber
            </span>
            <TrendingUp className="h-4.5 w-4.5 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mt-2">
            ₱{averageRevenuePerCustomer.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xxs text-slate-500 mt-1">ARPU across active fiber accounts</p>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/20 p-4 shadow-sm flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search by invoice ID, customer name, customer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none focus:border-blue-500/60 focus:bg-slate-900/70 placeholder:text-slate-500"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500/60"
        >
          <option value="All">All Invoices</option>
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Invoice Grid/Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Subscriber Name</th>
                <th className="px-6 py-4">Billing Period</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 font-mono">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No invoice records found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-800/10 transition-colors duration-150"
                  >
                    {/* Invoice ID */}
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-300">
                      {inv.invoiceNumber}
                    </td>
                    {/* Customer */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">
                        {inv.customerName}
                      </div>
                      <div className="text-xxs text-slate-500 font-mono mt-0.5">
                        {inv.customerId}
                      </div>
                    </td>
                    {/* Period */}
                    <td className="px-6 py-4 text-slate-300">
                      {inv.billingPeriodStart} &rarr; {inv.billingPeriodEnd}
                    </td>
                    {/* Due Date */}
                    <td className="px-6 py-4 text-slate-400">
                      {inv.dueDate}
                    </td>
                    {/* Amount */}
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">
                      ₱{inv.amount.toFixed(2)}
                    </td>
                    {/* Status badge */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xxs font-semibold leading-none ${
                        inv.status === "Paid"
                          ? "bg-green-500/15 text-green-400"
                          : inv.status === "Unpaid"
                          ? "bg-yellow-500/15 text-yellow-400"
                          : inv.status === "Overdue"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {inv.status}
                      </span>
                      {inv.status === "Paid" && (
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          Via {inv.paymentMethod} • {inv.paymentDate}
                        </div>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setShowPayModal(true);
                              }}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-green-600 px-2.5 text-xs font-semibold text-white shadow-xs hover:bg-green-500 transition-colors cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Pay
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Cancel invoice ${inv.invoiceNumber || inv.id}? This cannot be undone.`)) return;
                                try {
                                  await onCancelInvoice(inv.id);
                                } catch (err: any) {
                                  alert(err?.message || "Failed to cancel invoice.");
                                }
                              }}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {(inv.status === "Paid" || inv.status === "Cancelled") && (
                          <span className="text-xxs font-medium text-slate-500 italic">
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Invoice Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Record Payment</h2>
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedInvoice(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Invoice ID:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedInvoice.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Subscriber:</span>
                  <span className="font-semibold text-slate-200">{selectedInvoice.customerName}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-2 font-semibold">
                  <span className="text-slate-400">Amount Due:</span>
                  <span className="font-mono text-blue-400">₱{selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Payment Method
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {(["Cash", "Bank Transfer", "Credit Card", "Mobile Wallet", "Other"] as const).map((method) => {
                    const isSelected = payMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPayMethod(method)}
                        className={`rounded-xl border p-2.5 text-xs font-semibold text-left transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500/40 text-blue-400 animate-pulse"
                            : "border-slate-800 text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        {method === "Credit Card" && <CreditCard className="h-3.5 w-3.5" />}
                        {method === "Bank Transfer" && <Building className="h-3.5 w-3.5" />}
                        {method === "Cash" && <DollarSign className="h-3.5 w-3.5" />}
                        <span className="truncate">{method}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Reference No.
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  placeholder="Optional"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-800 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecordingPayment}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isRecordingPayment ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Generate Subscriber Bill</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Select Subscriber
                </label>
                <select
                  value={invCustomerId}
                  onChange={(e) => handleCustomerChangeInInvoice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                >
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Period Start
                  </label>
                  <input
                    type="date"
                    required
                    value={invPeriodStart}
                    onChange={(e) => setInvPeriodStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Period End
                  </label>
                  <input
                    type="date"
                    required
                    value={invPeriodEnd}
                    onChange={(e) => setInvPeriodEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Invoice Amount (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 font-mono"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-slate-800 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 cursor-pointer"
                >
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
