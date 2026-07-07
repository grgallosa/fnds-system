import React, { useState, useRef } from "react";
import {
  TrendingDown,
  Search,
  Plus,
  ArrowUpRight,
  Calculator,
  UploadCloud,
  FileText,
  X,
  FileCheck,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { AppState, Expense } from "../types";

interface ExpensesTabProps {
  state: AppState;
  onAddExpense: (expense: Omit<Expense, "id" | "recordedBy">) => void;
}

const EXPENSE_CATEGORIES = [
  "Repair Materials",
  "Fiber Cable",
  "Router Purchase",
  "ONU Purchase",
  "Fuel",
  "Transportation",
  "Office Supplies",
  "Internet Backbone Fee",
  "Electricity",
  "Employee Salary",
  "Vehicle Maintenance",
  "Equipment",
  "Miscellaneous",
];

export default function ExpensesTab({ state, onAddExpense }: ExpensesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Add Expense form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [receiptSim, setReceiptSim] = useState<{ name: string; size: string } | null>(null);

  // Drag and drop states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setReceiptSim({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptSim({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
      });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !vendor) {
      alert("Please fill in required fields.");
      return;
    }

    onAddExpense({
      date,
      category,
      amount: Number(amount),
      vendor,
      description,
      receiptImage: receiptSim ? `${receiptSim.name} (${receiptSim.size})` : undefined,
    });

    // Reset fields
    setDate(new Date().toISOString().split("T")[0]);
    setCategory(EXPENSE_CATEGORIES[0]);
    setAmount("");
    setVendor("");
    setDescription("");
    setReceiptSim(null);
    setShowAddModal(false);
  };

  // Financial calculations
  const totalPaidRevenue = state.invoices
    .filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + i.amount, 0);

  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalPaidRevenue - totalExpenses;

  // Category statistics aggregation
  const expensesByCategory: { [key: string]: number } = {};
  state.expenses.forEach((e) => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
  });

  const sortedCategories = Object.keys(expensesByCategory).map((cat) => ({
    category: cat,
    amount: expensesByCategory[cat],
  })).sort((a, b) => b.amount - a.amount);

  const highestCategory = sortedCategories[0]?.category || "None";
  const highestAmount = sortedCategories[0]?.amount || 0;

  const filteredExpenses = state.expenses.filter((e) => {
    const matchesSearch =
      e.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "All" || e.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-400" />
            Company Expenditures
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Log corporate costs, analyze operational overheads, and cross-reference profit margins.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Record Expense
        </button>
      </div>

      {/* Expense Analytics subheader */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Outflow */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Outflow (Expenses)
          </span>
          <h3 className="text-lg font-semibold text-slate-100 mt-2">
            ₱{totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-xxs text-slate-500 mt-1">Sum of all fiber cable, ONU, fuel, salary costs</p>
        </div>

        {/* Highest Category */}
        <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/40 p-5 shadow-sm">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Highest Cost Category
          </span>
          <h3 className="text-lg font-semibold text-slate-100 mt-2 truncate">
            {highestCategory}
          </h3>
          <p className="text-xxs text-red-400 font-semibold mt-1">
            Totaling ₱{highestAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Net Profit calculation formula */}
        <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Calculator className="h-4 w-4" />
              Dynamic Profit Margin
            </span>
            <h3 className={`text-lg font-semibold mt-2 ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              ₱{netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <p className="text-xxs text-slate-400 mt-2">
            Revenue (₱{totalPaidRevenue.toFixed(0)}) minus Expenses (₱{totalExpenses.toFixed(0)})
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/20 p-4 shadow-sm flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search by vendor, description, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none focus:border-blue-500/60 focus:bg-slate-900/70 placeholder:text-slate-500"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500/60"
        >
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Expense ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 font-mono">Amount</th>
                <th className="px-6 py-4 text-right">Receipt Attachment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No expense records matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-800/10 transition-colors duration-150"
                  >
                    {/* ID */}
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500">
                      {exp.id}
                    </td>
                    {/* Date */}
                    <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                      {exp.date}
                    </td>
                    {/* Category */}
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-lg bg-red-500/15 border border-red-500/25 px-2 py-0.5 text-xs font-semibold text-red-400">
                        {exp.category}
                      </span>
                    </td>
                    {/* Vendor */}
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {exp.vendor}
                    </td>
                    {/* Description */}
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">
                      {exp.description || "-"}
                    </td>
                    {/* Amount */}
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">
                      ₱{exp.amount.toFixed(2)}
                    </td>
                    {/* Receipt image / attachment sim */}
                    <td className="px-6 py-4 text-right">
                      {exp.receiptImage ? (
                        <span className="inline-flex items-center gap-1.5 text-xxs font-semibold bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded-md">
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          Receipt Attached
                        </span>
                      ) : (
                        <span className="text-xxs text-slate-500 italic">No receipt</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Record Company Outflow</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Amount (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 150.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 font-mono placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Expense Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vendor */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Vendor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZTE Supply"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Purchase of splicing equipment and accessories..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              {/* Receipts Uploader - drag and drop + manual upload */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Attach Vendor Receipt (PDF, JPG, PNG)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-1.5 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    dragActive
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-800 bg-slate-950 hover:bg-slate-900/60"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                  />
                  {receiptSim ? (
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                      <div className="flex items-center gap-2.5 truncate">
                        <FileCheck className="h-5 w-5 text-green-400 shrink-0" />
                        <div className="text-left truncate">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {receiptSim.name}
                          </p>
                          <span className="text-xxs text-slate-500 block">{receiptSim.size}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptSim(null);
                        }}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="h-8 w-8 text-slate-500 animate-bounce" />
                      <p className="text-xs text-slate-400 font-semibold mt-2">
                        Drag & Drop receipt or <span className="text-blue-400 hover:underline">browse files</span>
                      </p>
                      <span className="text-xxs text-slate-500 block mt-1">Supports images or PDF up to 5MB</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-800 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 cursor-pointer"
                >
                  Post Outflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
