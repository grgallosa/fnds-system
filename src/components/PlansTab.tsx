import React, { useState } from "react";
import { Wifi, Plus, Edit, X, Trash2 } from "lucide-react";
import { AppState, InternetPlan } from "../types";

interface PlansTabProps {
  state: AppState;
  onAddPlan: (plan: Omit<InternetPlan, "id">) => void | Promise<void>;
  onUpdatePlan: (id: string, updates: Partial<InternetPlan>) => void | Promise<void>;
  onDeletePlan?: (id: string) => void | Promise<void>;
}

export default function PlansTab({ state, onAddPlan, onUpdatePlan, onDeletePlan }: PlansTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [speed, setSpeed] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !speed || !price) {
      alert("Please fill in required fields.");
      return;
    }
    try {
      await onAddPlan({
        name,
        speed,
        monthlyPrice: Number(price),
        description,
        status: "Active",
      });
      // Reset Form - only on success
      setName("");
      setSpeed("");
      setPrice("");
      setDescription("");
      setShowAddModal(false);
    } catch (err: any) {
      alert(err?.message || "Failed to create plan.");
    }
  };

  const handleOpenEdit = (plan: InternetPlan) => {
    setSelectedPlanId(plan.id);
    setName(plan.name);
    setSpeed(plan.speed);
    setPrice(plan.monthlyPrice.toString());
    setDescription(plan.description);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !name || !speed || !price) return;

    try {
      await onUpdatePlan(selectedPlanId, {
        name,
        speed,
        monthlyPrice: Number(price),
        description,
      });

      setShowEditModal(false);
      setSelectedPlanId(null);
    } catch (err: any) {
      alert(err?.message || "Failed to save plan changes.");
    }
  };

  const handleDeletePlan = async (plan: InternetPlan) => {
    if (!onDeletePlan) return;
    if (!confirm(`Delete the "${plan.name}" plan permanently? This cannot be undone.`)) return;
    try {
      await onDeletePlan(plan.id);
    } catch (err: any) {
      alert(err?.message || "Failed to delete plan.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <Wifi className="h-5 w-5 text-blue-400" />
            Internet Service Plans
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Design internet broadband tiers, update bandwidth capacities, and adjust subscription rates.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Create New Plan
        </button>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {state.plans.map((plan) => {
          // Dynamic subscribers metric from state.customers
          const activeSubsCount = state.customers.filter(
            (c) => c.currentPlanId === plan.id && c.status === "Active"
          ).length;

          return (
            <div
              key={plan.id}
              className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1222]/40 text-slate-100 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-slate-700/60 flex flex-col justify-between"
            >
              {/* Plan content */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 leading-snug">
                      {plan.name}
                    </h3>
                    <span className="inline-block mt-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">
                      {plan.speed}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white leading-none">
                      ₱{plan.monthlyPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500 block mt-1">/mo</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-4 leading-relaxed line-clamp-3">
                  {plan.description}
                </p>
              </div>

              {/* Footer details */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Active Subscribers
                  </span>
                  <span className="text-sm font-semibold text-slate-300 mt-1 block">
                    {activeSubsCount} {activeSubsCount === 1 ? "User" : "Users"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onDeletePlan && (
                    <button
                      onClick={() => handleDeletePlan(plan)}
                      title="Delete Plan"
                      className="rounded-lg p-1.5 border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Plan
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Create New Broadband Plan</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard 100 Mbps"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Internet Speed *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100 Mbps"
                    value={speed}
                    onChange={(e) => setSpeed(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Monthly Price (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 49.99"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 font-mono placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Description / Features
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe bandwidth details, routing priority, and connection SLA..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
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
                  Deploy Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Modify Broadband Tier</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Internet Speed *
                  </label>
                  <input
                    type="text"
                    required
                    value={speed}
                    onChange={(e) => setSpeed(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Monthly Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Description / Features
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-xl border border-slate-800 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
