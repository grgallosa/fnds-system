import React, { useState } from "react";
import { UserCheck, Plus, Mail, Phone, Calendar, Star, Award, X, Sparkles, Edit } from "lucide-react";
import { AppState, Technician } from "../types";

interface TechniciansTabProps {
  state: AppState;
  onAddTechnician: (
    tech: Omit<Technician, "id"> & { username?: string; password?: string }
  ) => void;
  onUpdateTechnicianStatus: (id: string, status: "Active" | "On Leave" | "Inactive") => void;
  onUpdateTechnician?: (id: string, updates: Partial<Technician>) => void;
  onSetTechnicianCredentials?: (id: string, username: string, password: string) => Promise<void>;
}

export default function TechniciansTab({
  state,
  onAddTechnician,
  onUpdateTechnicianStatus,
  onUpdateTechnician,
  onSetTechnicianCredentials,
}: TechniciansTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("Field Repair Technician");
  const [status, setStatus] = useState<"Active" | "On Leave" | "Inactive">("Active");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPosition, setEditPosition] = useState("Field Repair Technician");
  const [editStatus, setEditStatus] = useState<"Active" | "On Leave" | "Inactive">("Active");
  const [credUsername, setCredUsername] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credStatus, setCredStatus] = useState<null | "saving" | "saved" | "error">(null);

  const handleEditClick = (tech: Technician) => {
    setEditingTechnician(tech);
    setEditName(tech.name);
    setEditPhone(tech.phone);
    setEditEmail(tech.email);
    setEditPosition(tech.position);
    setEditStatus(tech.status);
    setCredUsername("");
    setCredPassword("");
    setCredStatus(null);
  };

  const handleSetCredentials = async () => {
    if (!editingTechnician || !onSetTechnicianCredentials) return;
    if (!credUsername || credPassword.length < 8) return;
    setCredStatus("saving");
    try {
      await onSetTechnicianCredentials(editingTechnician.id, credUsername, credPassword);
      setCredStatus("saved");
      setCredPassword("");
    } catch {
      setCredStatus("error");
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTechnician) return;
    if (!editName || !editPhone || !editEmail) {
      alert("Please fill in required fields.");
      return;
    }

    if (onUpdateTechnician) {
      onUpdateTechnician(editingTechnician.id, {
        name: editName,
        phone: editPhone,
        email: editEmail,
        position: editPosition,
        status: editStatus,
      });
    } else {
      onUpdateTechnicianStatus(editingTechnician.id, editStatus);
    }

    setEditingTechnician(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !email) {
      alert("Please fill in required fields.");
      return;
    }

    onAddTechnician({
      name,
      phone,
      email,
      position,
      status,
      profilePicture: name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      joinedDate: new Date().toISOString().split("T")[0],
      username: loginUsername || undefined,
      password: loginPassword || undefined,
    });

    setName("");
    setPhone("");
    setEmail("");
    setLoginUsername("");
    setLoginPassword("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-400" />
            Technician Fleet Profiles
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor technician operational status, audit completed ticket metrics, and onboard new field specialists.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Onboard Technician
        </button>
      </div>

      {/* Grid of Technicians */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {state.technicians.map((tech) => {
          // Dynamic tasks calculations from state.tasks
          const assignedTasks = state.tasks.filter((t) => t.assignedTechnicianId === tech.id);
          const completedCount = assignedTasks.filter((t) => t.status === "Completed").length;
          const pendingCount = assignedTasks.filter(
            (t) => t.status !== "Completed" && t.status !== "Cancelled"
          ).length;

          // Performance Score Calculation: Completed Ratio + Base modifier
          const totalResolvedRatio =
            assignedTasks.length > 0 ? (completedCount / assignedTasks.length) * 100 : 100;

          // Star ratings mapped from performance ratio
          const starRating = totalResolvedRatio >= 85 ? 5 : totalResolvedRatio >= 65 ? 4 : 3;

          return (
            <div
              key={tech.id}
              className={`rounded-2xl border p-6 shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                tech.status === "Active"
                  ? "border-slate-800 bg-[#0c1222]/40"
                  : tech.status === "On Leave"
                  ? "border-orange-500/15 bg-orange-500/5"
                  : "border-slate-800/80 bg-slate-900/20"
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-4 truncate">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold text-base shadow-sm shrink-0 uppercase">
                      {tech.profilePicture}
                    </div>
                    <div className="truncate">
                      <h3 className="text-base font-bold text-slate-200 leading-snug truncate">
                        {tech.name}
                      </h3>
                      <span className="text-xs text-slate-500 block mt-0.5 truncate">
                        ID: {tech.id} • {tech.position}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEditClick(tech)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Edit Technician Details"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>

                {/* Rating & status */}
                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      tech.status === "Active"
                        ? "bg-green-500 animate-pulse"
                        : tech.status === "On Leave"
                        ? "bg-orange-500"
                        : "bg-slate-500"
                    }`} />
                    <select
                      value={tech.status}
                      onChange={(e) => onUpdateTechnicianStatus(tech.id, e.target.value as any)}
                      className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer hover:text-slate-100"
                    >
                      <option className="bg-slate-900 text-slate-100" value="Active">Active</option>
                      <option className="bg-slate-900 text-slate-100" value="On Leave">On Leave</option>
                      <option className="bg-slate-900 text-slate-100" value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-3.5 w-3.5 ${
                          index < starRating ? "text-yellow-400 fill-yellow-400" : "text-slate-800"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Contact metadata */}
                <div className="mt-4 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>{tech.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{tech.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>Joined: {tech.joinedDate}</span>
                  </div>
                </div>
              </div>

              {/* Live metrics counters */}
              <div className="mt-6 pt-4 border-t border-slate-800/60 grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-xl bg-blue-500/5 p-2 border border-blue-500/10">
                  <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider block">
                    Active Tasks
                  </span>
                  <span className="text-sm font-bold text-blue-300 mt-1 block">
                    {pendingCount}
                  </span>
                </div>

                <div className="rounded-xl bg-green-500/5 p-2 border border-green-500/10">
                  <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider block">
                    Completed
                  </span>
                  <span className="text-sm font-bold text-green-300 mt-1 block">
                    {completedCount}
                  </span>
                </div>

                <div className="rounded-xl bg-purple-500/5 p-2 border border-purple-500/10">
                  <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block">
                    Resolution
                  </span>
                  <span className="text-sm font-bold text-purple-300 mt-1 block">
                    {totalResolvedRatio.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Onboard Technician Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Onboard Field Technician</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +1 (555) 041-8811"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sjenkins@ispsystem.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Fleet Designation
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                >
                  <option value="Senior Fiber Specialist">Senior Fiber Specialist</option>
                  <option value="Field Repair Technician">Field Repair Technician</option>
                  <option value="Junior Installation Tech">Junior Installation Tech</option>
                  <option value="Support Supervisor">Support Supervisor</option>
                </select>
              </div>

              {/* Initial Status */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Active Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                >
                  <option value="Active">Active & Available</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Portal Login (optional) */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Technician Portal Login (optional)
                </p>
                <p className="text-[11px] text-slate-500 -mt-2">
                  Set a username and password so this technician can sign in to their own
                  dashboard. You can also add this later by editing the technician.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Username
                  </label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. jsmith"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Temporary Password
                  </label>
                  <input
                    type="text"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
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
                  Onboard Technician
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTechnician && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Edit Technician Details</h2>
              <button
                onClick={() => setEditingTechnician(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +1 (555) 041-8811"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sjenkins@ispsystem.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Fleet Designation
                </label>
                <select
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                >
                  <option value="Senior Fiber Specialist">Senior Fiber Specialist</option>
                  <option value="Field Repair Technician">Field Repair Technician</option>
                  <option value="Junior Installation Tech">Junior Installation Tech</option>
                  <option value="Support Supervisor">Support Supervisor</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Active Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                >
                  <option value="Active">Active & Available</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Portal Login credentials - set or reset */}
              {onSetTechnicianCredentials && (
                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Portal Login
                  </p>
                  <p className="text-[11px] text-slate-500 -mt-2">
                    Set a new username/password to create or reset this technician's login.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={credUsername}
                      onChange={(e) => setCredUsername(e.target.value)}
                      placeholder="Username"
                      className="rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                    />
                    <input
                      type="text"
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSetCredentials}
                    disabled={!credUsername || credPassword.length < 8 || credStatus === "saving"}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {credStatus === "saving" ? "Saving..." : "Save Login Credentials"}
                  </button>
                  {credStatus === "saved" && (
                    <p className="text-xs text-green-400">Login credentials updated.</p>
                  )}
                  {credStatus === "error" && (
                    <p className="text-xs text-red-400">
                      Failed to update credentials (username may already be taken).
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTechnician(null)}
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
