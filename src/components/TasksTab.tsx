import React, { useState } from "react";
import {
  Wrench,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  X,
  FileCheck,
  ChevronRight,
  HardHat,
  Eye,
  CheckSquare
} from "lucide-react";
import { AppState, RepairTask, Customer, Technician, CompletionNotes } from "../types";

interface TasksTabProps {
  state: AppState;
  onAddTask: (task: Omit<RepairTask, "id" | "dateCreated">) => void | Promise<void>;
  onUpdateTaskStatus: (id: string, status: RepairTask["status"]) => void | Promise<void>;
  onAddTaskCompletion: (id: string, notes: CompletionNotes) => void | Promise<void>;
  onEditTask?: (id: string, updates: Partial<RepairTask>) => void | Promise<void>;
  onDeleteTask?: (id: string) => void | Promise<void>;
  onAddTaskNote?: (id: string, note: string) => void | Promise<void>;
  selectedTaskId?: string;
  onCloseDetailView?: () => void;
}

export default function TasksTab({
  state,
  onAddTask,
  onUpdateTaskStatus,
  onAddTaskCompletion,
  onEditTask,
  onDeleteTask,
  onAddTaskNote,
  selectedTaskId,
  onCloseDetailView,
}: TasksTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");

  // Admin: Create Task state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskCustomerId, setTaskCustomerId] = useState(state.customers[0]?.id || "");
  const [taskTechId, setTaskTechId] = useState(state.technicians[0]?.id || "");
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High" | "Emergency">("Medium");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskSchedDate, setTaskSchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskDuration, setTaskDuration] = useState("1.5 hours");

  // Tech: Completion Notes Form state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [problemFound, setProblemFound] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [completionTime, setCompletionTime] = useState("");
  const [customerConfirmed, setCustomerConfirmed] = useState(true);

  // Detail Drawer state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(selectedTaskId || null);

  // Admin: Edit Task modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editTechId, setEditTechId] = useState("");
  const [editPriority, setEditPriority] = useState<"Low" | "Medium" | "High" | "Emergency">("Medium");
  const [editSchedDate, setEditSchedDate] = useState("");
  const [editDuration, setEditDuration] = useState("");

  // Technician: quick note/remark state
  const [noteDraft, setNoteDraft] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  React.useEffect(() => {
    if (selectedTaskId) {
      setActiveTaskId(selectedTaskId);
    }
  }, [selectedTaskId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = state.customers.find((c) => c.id === taskCustomerId);
    if (!cust) return;

    try {
      await onAddTask({
        customerId: taskCustomerId,
        customerName: cust.fullName,
        assignedTechnicianId: taskTechId,
        priority: taskPriority,
        description: taskDesc,
        address: cust.address,
        scheduledDate: taskSchedDate,
        estimatedDuration: taskDuration,
        status: "Assigned",
      });

      setTaskDesc("");
      setShowCreateModal(false);
    } catch (err: any) {
      alert(err?.message || "Failed to create task.");
    }
  };

  const handleCompletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTaskId) return;

    try {
      await onAddTaskCompletion(completingTaskId, {
        problemFound,
        workPerformed,
        materialsUsed,
        additionalRecommendation: recommendation,
        completionTime,
        customerConfirmation: customerConfirmed,
      });

      // Reset completion form - only on success
      setProblemFound("");
      setWorkPerformed("");
      setMaterialsUsed("");
      setRecommendation("");
      setCompletionTime("");
      setCustomerConfirmed(true);
      setCompletingTaskId(null);
      setShowCompleteModal(false);
    } catch (err: any) {
      alert(err?.message || "Failed to submit completion notes.");
    }
  };

  const openEditModal = (task: RepairTask) => {
    setEditDesc(task.description);
    setEditTechId(task.assignedTechnicianId || "");
    setEditPriority(task.priority);
    setEditSchedDate(task.scheduledDate);
    setEditDuration(task.estimatedDuration);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskId || !onEditTask) return;
    try {
      await onEditTask(activeTaskId, {
        description: editDesc,
        assignedTechnicianId: editTechId,
        priority: editPriority,
        scheduledDate: editSchedDate,
        estimatedDuration: editDuration,
      });
      setShowEditModal(false);
    } catch (err: any) {
      alert(err?.message || "Failed to save task changes.");
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!onDeleteTask) return;
    if (confirm("Delete this repair task permanently? This cannot be undone.")) {
      try {
        await onDeleteTask(id);
        setActiveTaskId(null);
        if (onCloseDetailView) onCloseDetailView();
      } catch (err: any) {
        alert(err?.message || "Failed to delete task.");
      }
    }
  };

  const handleSubmitNote = async () => {
    if (!activeTaskId || !onAddTaskNote || !noteDraft.trim()) return;
    setIsSubmittingNote(true);
    try {
      await onAddTaskNote(activeTaskId, noteDraft.trim());
      setNoteDraft("");
    } finally {
      setIsSubmittingNote(false);
    }
  };


  const isTech = state.role === "TECHNICIAN";
  const tasksToRender = state.tasks.filter((task) => {
    // Technician only sees their assigned tasks
    if (isTech && task.assignedTechnicianId !== state.activeTechnicianId) {
      return false;
    }

    if (isTech) {
      // Technicians see all their assigned tasks directly
      return true;
    }

    const matchesSearch =
      task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort tasks for better usability: In Progress first, then Assigned, then Completed
  const sortedTasks = [...tasksToRender].sort((a, b) => {
    if (isTech) {
      const statusOrder: Record<string, number> = {
        "In Progress": 1,
        "Assigned": 2,
        "On The Way": 3,
        "Completed": 4,
        "Cancelled": 5,
        "Pending": 6
      };
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    }
    return 0; // Default ordering
  });

  const selectedTask = state.tasks.find((t) => t.id === activeTaskId);
  const selectedTaskCustomer = state.customers.find((c) => c.id === selectedTask?.customerId);
  const selectedTaskTech = state.technicians.find((t) => t.id === selectedTask?.assignedTechnicianId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-400" />
            {isTech ? "My Field Assignments" : "Repair & Service Dispatch"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isTech
              ? `You have ${sortedTasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled").length} active service tickets assigned.`
              : "Dispatch field specialists, monitor ticket repair steps, and review technician audit notes."}
          </p>
        </div>

        {!isTech && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Create Service Ticket
          </button>
        )}
      </div>

      {/* Filters with touch-friendly swipe status pills - ONLY FOR ADMIN */}
      {!isTech && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {["All", "Assigned", "On The Way", "In Progress", "Completed"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  statusFilter === status
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/15"
                    : "bg-slate-900/60 text-slate-400 border-slate-800/80 hover:text-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/20 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Search service tickets by number, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2 pl-9 pr-4 text-xs sm:text-sm text-slate-100 outline-none focus:border-blue-500/60 focus:bg-slate-900/70 placeholder:text-slate-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              {!isTech && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500/60 h-9.5 cursor-pointer w-full sm:w-auto font-medium"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Assigned">Assigned</option>
                  <option value="On The Way">On The Way</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              )}

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500/60 h-9.5 cursor-pointer w-full sm:w-auto font-medium"
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Task List Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sortedTasks.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-800 bg-[#0c1222]/30 p-12 text-center text-slate-500">
            No service tickets matching current filters.
          </div>
        ) : (
          sortedTasks.map((task) => {
            const tech = state.technicians.find((t) => t.id === task.assignedTechnicianId);
            const isEmergency = task.priority === "Emergency";

            // Tech workflow action renderer
            const renderWorkflowButton = () => {
              if (!isTech) return null;
              if (task.status === "Assigned") {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateTaskStatus(task.id, "In Progress");
                    }}
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer min-h-[40px]"
                  >
                    Accept Assignment ✅
                  </button>
                );
              }
              if (task.status === "On The Way" || task.status === "In Progress") {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompletingTaskId(task.id);
                      setShowCompleteModal(true);
                    }}
                    className="w-full rounded-xl bg-green-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-green-500 transition-colors cursor-pointer min-h-[40px]"
                  >
                    Mark as Done / Resolve 📝
                  </button>
                );
              }
              return null;
            };

            return (
              <div
                key={task.id}
                onClick={() => setActiveTaskId(task.id)}
                className={`rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer ${
                  isEmergency 
                    ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/10" 
                    : "border-slate-800 bg-[#0c1222]/40 hover:bg-[#0c1222]/60"
                }`}
              >
                <div>
                  {/* Title & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] sm:text-xs font-semibold text-slate-500 block">
                        {task.id}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-200 mt-0.5 leading-snug truncate">
                        {task.customerName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] sm:text-xxs font-bold uppercase tracking-wider ${
                        task.priority === "Emergency"
                          ? "bg-red-500/20 text-red-400 border border-red-500/20"
                          : task.priority === "High"
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/10"
                          : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {task.priority}
                      </span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] sm:text-xxs font-semibold ${
                        task.status === "Completed"
                          ? "bg-green-500/15 text-green-400"
                          : task.status === "In Progress"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {/* Address & Desc */}
                  <div className="mt-3.5 space-y-2 text-xs text-slate-300">
                    <div className="flex items-start gap-2 leading-relaxed font-medium">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
                      <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                        <span className="truncate">{task.address}</span>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(task.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-400 hover:underline font-bold shrink-0 inline-flex items-center gap-0.5 text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                        >
                          Maps 🗺️
                        </a>
                      </div>
                    </div>
                    <p className="text-slate-400 pl-6 border-l border-slate-800/80 ml-2 text-[11px] sm:text-xs">
                      {task.description}
                    </p>
                  </div>
                </div>

                {/* Footer details */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-3">
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Sched: {task.scheduledDate}
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <HardHat className="h-3.5 w-3.5 text-slate-400" />
                      Assigned: {tech?.name?.split(" ")[0] || "Unassigned"}
                    </span>
                  </div>

                  {/* Actions / Workflow button */}
                  <div className="pt-1 flex flex-col sm:flex-row items-stretch gap-2">
                    {renderWorkflowButton() && (
                      <div className="flex-1 min-w-0">
                        {renderWorkflowButton()}
                      </div>
                    )}
                    {!isTech && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTaskId(task.id);
                        }}
                        className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[40px]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Full Details
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task Detail Drawer */}
      {activeTaskId && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="relative w-full sm:max-w-lg bg-[#0c111d] border-l border-slate-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div>
                <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                  {selectedTask.id} • Work Order details
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-1 leading-none">
                  {selectedTask.customerName}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {!isTech && onEditTask && (
                  <button
                    onClick={() => openEditModal(selectedTask)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 cursor-pointer"
                  >
                    Edit
                  </button>
                )}
                {!isTech && onDeleteTask && (
                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveTaskId(null);
                    if (onCloseDetailView) onCloseDetailView();
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
              {/* Primary task details block */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Priority</span>
                  <span className="font-semibold text-red-400">{selectedTask.priority}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Status</span>
                  <span className="font-semibold text-blue-400">{selectedTask.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Scheduled Date</span>
                  <span>{selectedTask.scheduledDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Estimated Duration</span>
                  <span>{selectedTask.estimatedDuration}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/60 pt-2.5">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Assigned Technician</span>
                  <span className="font-semibold text-slate-200">{selectedTaskTech?.name || "Unassigned"}</span>
                </div>
              </div>

              {/* Task Work Description */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Problem Description</h3>
                <p className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 text-slate-400 leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>

              {/* Location details */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Site Address</h3>
                <p className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 rounded-xl p-3 text-slate-400 leading-relaxed">
                  <MapPin className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                  {selectedTask.address}
                </p>
              </div>

              {/* Technician: add a note/remark without necessarily completing */}
              {isTech && onAddTaskNote && selectedTask.status !== "Completed" && (
                <div className="space-y-1.5 border-t border-slate-800 pt-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Add Note / Repair Remark
                  </h3>
                  <textarea
                    rows={2}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="e.g. Waiting on customer to be home, checked ONT signal levels..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                  <button
                    onClick={handleSubmitNote}
                    disabled={isSubmittingNote || !noteDraft.trim()}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmittingNote ? "Saving..." : "Save Note"}
                  </button>
                </div>
              )}

              {/* Completion Notes Details */}
              {selectedTask.status === "Completed" && selectedTask.completionNotes && (
                <div className="space-y-4 border-t border-slate-800 pt-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 text-green-400">
                    <FileCheck className="h-4 w-4" />
                    Field Completion Audit Report
                  </h3>
                  <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4 space-y-4 text-xs text-slate-300">
                    <div>
                      <span className="font-bold text-slate-400 uppercase block tracking-wider text-[10px]">Problem Found</span>
                      <p className="mt-1 leading-relaxed text-slate-400">{selectedTask.completionNotes.problemFound}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase block tracking-wider text-[10px]">Work Performed</span>
                      <p className="mt-1 leading-relaxed text-slate-400">{selectedTask.completionNotes.workPerformed}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase block tracking-wider text-[10px]">Materials & Fiber Used</span>
                      <p className="mt-1 leading-relaxed text-slate-400">{selectedTask.completionNotes.materialsUsed}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 uppercase block tracking-wider text-[10px]">Field Recommendations</span>
                      <p className="mt-1 leading-relaxed text-slate-400">{selectedTask.completionNotes.additionalRecommendation || "None"}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-green-500/10 pt-2.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Time Taken</span>
                      <span className="font-mono font-bold text-slate-200">{selectedTask.completionNotes.completionTime}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-medium text-green-400">
                      <CheckSquare className="h-4 w-4 shrink-0" />
                      <span>Customer signed & confirmed restoration</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin: Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Create Field Service Ticket</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Subscriber Customer
                </label>
                <select
                  value={taskCustomerId}
                  onChange={(e) => setTaskCustomerId(e.target.value)}
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
                {/* Tech dispatch */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Dispatch Technician
                  </label>
                  <select
                    value={taskTechId}
                    onChange={(e) => setTaskTechId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  >
                    {state.technicians.filter((t) => t.status === "Active").map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    SLA Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Sched date */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskSchedDate}
                    onChange={(e) => setTaskSchedDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Est. Duration
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.5 hours"
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Problem Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe connection failure symptoms, attenuation, cut physical wires..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
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
                  Issue Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Edit Task Modal */}
      {showEditModal && activeTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Edit Service Ticket</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Assigned Technician
                  </label>
                  <select
                    value={editTechId}
                    onChange={(e) => setEditTechId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  >
                    <option value="">Unassigned</option>
                    {state.technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    SLA Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editSchedDate}
                    onChange={(e) => setEditSchedDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Est. Duration
                  </label>
                  <input
                    type="text"
                    required
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Problem Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
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

      {/* Tech completion Modal */}
      {showCompleteModal && completingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Write Completion Notes</h2>
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setCompletingTaskId(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCompletionSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Problem Found *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Severed optic drop wire near terminal pole"
                  value={problemFound}
                  onChange={(e) => setProblemFound(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Work Performed *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Spliced 2-core drop wire, tested attenuation (-18.2 dBm), re-anchored hooks."
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Materials Used
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15m optical drop cable, 1 tension clamp"
                  value={materialsUsed}
                  onChange={(e) => setMaterialsUsed(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Additional Recommendations
                </label>
                <input
                  type="text"
                  placeholder="e.g. House trees will need branch cutting soon."
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Completion Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Total Time Spent
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 45 minutes"
                    value={completionTime}
                    onChange={(e) => setCompletionTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                  />
                </div>

                {/* Customer Confirmation checkbox */}
                <div className="flex items-center pl-1 pt-6">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customerConfirmed}
                      onChange={(e) => setCustomerConfirmed(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-800 bg-slate-900 text-green-500 focus:ring-green-500/50 focus:ring-offset-0"
                    />
                    Customer Verified
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompleteModal(false);
                    setCompletingTaskId(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-800 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 cursor-pointer"
                >
                  Submit Completion Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
