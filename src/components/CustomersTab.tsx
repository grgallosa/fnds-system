import React, { useState } from "react";
import {
  Users,
  User,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  History,
  X,
  PlusCircle,
  Eye,
  AlertOctagon,
  Edit,
  FileSpreadsheet,
  Upload,
  Trash2
} from "lucide-react";
import * as XLSX from "xlsx";
import { AppState, Customer, InternetPlan, CustomerTimelineEvent, Invoice, BillingStatus } from "../types";

/** Colored badge for a customer's billing standing (🟢 Current / 🟡 Due Soon / 🔴 Overdue). */
function BillingStatusBadge({ status }: { status: BillingStatus }) {
  const styles: Record<BillingStatus, string> = {
    Current: "bg-green-500/15 text-green-400",
    "Due Soon": "bg-yellow-500/15 text-yellow-400",
    Overdue: "bg-red-500/15 text-red-400",
  };
  const dotStyles: Record<BillingStatus, string> = {
    Current: "bg-green-400",
    "Due Soon": "bg-yellow-400",
    Overdue: "bg-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status]}`} />
      {status}
    </span>
  );
}

interface CustomersTabProps {
  state: AppState;
  onAddCustomer: (
    customer: Omit<Customer, "id" | "nextDueDate" | "billingStatus" | "billingStartDate" | "dueDay"> &
      Partial<Pick<Customer, "billingStartDate" | "dueDay">>
  ) => void;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => void;
  onAddTimelineEvent: (customerId: string, action: string, description: string) => void;
  onTriggerTaskForCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void | Promise<void>;
  selectedCustomerId?: string;
  onCloseDetailView?: () => void;
}

export default function CustomersTab({
  state,
  onAddCustomer,
  onUpdateCustomer,
  onAddTimelineEvent,
  onTriggerTaskForCustomer,
  onDeleteCustomer,
  selectedCustomerId,
  onCloseDetailView,
}: CustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [planFilter, setPlanFilter] = useState<string>("All");

  // Add customer form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPlanId, setNewPlanId] = useState(state.plans[0]?.id || "");
  const [newFee, setNewFee] = useState(state.plans[0]?.monthlyPrice || 29.99);
  const [newStatus, setNewStatus] = useState<"Active" | "Suspended" | "Disconnected">("Active");
  const [newInstallationDate, setNewInstallationDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  // Billing start date defaults to the installation date; due day is
  // derived server-side from it unless the admin overrides it explicitly.
  const [newBillingStartDate, setNewBillingStartDate] = useState<string>("");
  const [newDueDayOverride, setNewDueDayOverride] = useState<string>("");

  // Selected customer for detailed view side drawer
  const [activeDetailsId, setActiveDetailsId] = useState<string | null>(selectedCustomerId || null);

  // Edit customer form state inside Side Drawer
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPlanId, setEditPlanId] = useState("");
  const [editFee, setEditFee] = useState<number>(0);
  const [editUsername, setEditUsername] = useState("");
  const [editBillingStartDate, setEditBillingStartDate] = useState("");
  const [editDueDay, setEditDueDay] = useState<string>("");

  // Spreadsheet import states
  interface ParsedCustomerRow {
    rowNum: number;
    fullName: string;
    email: string;
    contactNumber: string;
    address: string;
    currentPlanId: string;
    monthlyFee: number;
    status: "Active" | "Suspended" | "Disconnected";
    errors: string[];
  }

  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedCustomerRow[]>([]);
  const [importError, setImportError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          setImportError("The uploaded spreadsheet is empty.");
          setParsedRows([]);
          return;
        }

        const parsed: ParsedCustomerRow[] = rows.map((row, index) => {
          const keys = Object.keys(row);
          const findVal = (possibleKeys: string[]) => {
            const matchedKey = keys.find(k => 
              possibleKeys.some(pk => k.toLowerCase().replace(/[^a-z0-9]/g, "") === pk.toLowerCase().replace(/[^a-z0-9]/g, ""))
            );
            return matchedKey ? String(row[matchedKey]).trim() : "";
          };

          const fullName = findVal(["fullname", "name", "customername", "full name", "customer name"]);
          const email = findVal(["email", "emailaddress", "email address"]);
          const contactNumber = findVal(["contactnumber", "phone", "phonenumber", "contact number", "contact", "phone number"]);
          const address = findVal(["address", "physicaladdress", "installationaddress", "physical address", "installation address", "location"]);
          const planIdRaw = findVal(["planid", "plan", "currentplanid", "plan id", "internetplan", "internet plan", "package"]);
          const monthlyFeeRaw = findVal(["monthlyfee", "fee", "monthlyprice", "price", "monthly fee", "monthly fee $"]);
          const statusRaw = findVal(["status", "accountstatus", "status", "active status"]);

          // Map plan ID or name
          let currentPlanId = "";
          if (planIdRaw) {
            const foundPlan = state.plans.find(
              p => p.id.toLowerCase() === planIdRaw.toLowerCase() || p.name.toLowerCase() === planIdRaw.toLowerCase()
            );
            if (foundPlan) {
              currentPlanId = foundPlan.id;
            }
          }
          if (!currentPlanId) {
            currentPlanId = state.plans[0]?.id || "PLAN-1";
          }

          // Fee fallback
          let monthlyFee = Number(monthlyFeeRaw);
          if (isNaN(monthlyFee) || monthlyFee <= 0) {
            const plan = state.plans.find(p => p.id === currentPlanId);
            monthlyFee = plan ? plan.monthlyPrice : 29.99;
          }

          // Status mapping
          let status: "Active" | "Suspended" | "Disconnected" = "Active";
          const cleanStatus = statusRaw.toLowerCase();
          if (cleanStatus === "suspended") status = "Suspended";
          else if (cleanStatus === "disconnected") status = "Disconnected";

          // Row validation errors
          const errors: string[] = [];
          if (!fullName) errors.push("Missing name");
          if (!email) {
            errors.push("Missing email");
          } else if (!email.includes("@")) {
            errors.push("Invalid email");
          }
          if (!contactNumber) errors.push("Missing phone");
          if (!address) errors.push("Missing address");

          return {
            rowNum: index + 2, // 1-based, accounts for header row
            fullName,
            email,
            contactNumber,
            address,
            currentPlanId,
            monthlyFee,
            status,
            errors,
          };
        });

        setParsedRows(parsed);
        setImportError("");
        setSuccessCount(null);
      } catch (err: any) {
        setImportError(`Failed to parse file: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent = 
      "Full Name,Email,Contact Number,Address,Plan ID,Monthly Fee,Status\n" +
      '"John Doe","john@example.com","+1 (555) 019-1234","123 Main St, Springfield","PLAN-1",29.99,"Active"\n' +
      '"Jane Smith","jane@example.com","+1 (555) 019-5678","456 Elm St, Shelbyville","PLAN-2",49.99,"Active"';
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "customer_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = () => {
    const validRows = parsedRows.filter(r => r.errors.length === 0);
    if (validRows.length === 0) {
      alert("No valid rows to import.");
      return;
    }

    validRows.forEach(row => {
      onAddCustomer({
        fullName: row.fullName,
        address: row.address,
        contactNumber: row.contactNumber,
        email: row.email,
        installationDate: new Date().toISOString().split("T")[0],
        currentPlanId: row.currentPlanId,
        monthlyFee: row.monthlyFee,
        status: row.status,
      });
    });

    setSuccessCount(validRows.length);
    setTimeout(() => {
      setShowImportModal(false);
      setParsedRows([]);
      setSuccessCount(null);
    }, 2000);
  };

  // Sync selectedCustomerId from props if active
  React.useEffect(() => {
    if (selectedCustomerId) {
      setActiveDetailsId(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // Handle plan selection change in form to auto-fill default fee
  const handlePlanChange = (planId: string) => {
    setNewPlanId(planId);
    const plan = state.plans.find((p) => p.id === planId);
    if (plan) {
      setNewFee(plan.monthlyPrice);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newAddress || !newPhone || !newEmail) {
      alert("Please fill in all fields.");
      return;
    }

    onAddCustomer({
      fullName: newFullName,
      address: newAddress,
      contactNumber: newPhone,
      email: newEmail,
      installationDate: newInstallationDate,
      currentPlanId: newPlanId,
      monthlyFee: Number(newFee),
      status: newStatus,
      username: newUsername || newEmail.split("@")[0] || newFullName.toLowerCase().replace(/\s+/g, "."),
      billingStartDate: newBillingStartDate || undefined,
      dueDay: newDueDayOverride ? Number(newDueDayOverride) : undefined,
    });

    // Reset Form
    setNewFullName("");
    setNewAddress("");
    setNewPhone("");
    setNewEmail("");
    setNewUsername("");
    setNewInstallationDate(new Date().toISOString().slice(0, 10));
    setNewBillingStartDate("");
    setNewDueDayOverride("");
    setShowAddModal(false);
  };

  const handleStatusChange = (cust: Customer, newStatus: "Active" | "Suspended" | "Disconnected") => {
    onUpdateCustomer(cust.id, { status: newStatus });
    
    // Log timeline
    let action = "Customer Activated";
    let desc = `Customer account service has been re-activated by Administrator.`;
    if (newStatus === "Suspended") {
      action = "Customer Suspended";
      desc = `Customer account was suspended due to billing or policy action.`;
    } else if (newStatus === "Disconnected") {
      action = "Customer Disconnected";
      desc = `Service disconnected permanently. ONU deactivated.`;
    }

    onAddTimelineEvent(cust.id, action, desc);
  };

  // Filter logic
  const filteredCustomers = state.customers.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contactNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "All" || c.status === statusFilter;
    const matchesPlan = planFilter === "All" || c.currentPlanId === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const selectedCustomer = state.customers.find((c) => c.id === activeDetailsId);
  const selectedPlan = state.plans.find((p) => p.id === selectedCustomer?.currentPlanId);
  const customerTimeline = state.timelines.filter((t) => t.customerId === activeDetailsId);
  const customerInvoices = state.invoices.filter((i) => i.customerId === activeDetailsId);
  const customerTasks = state.tasks.filter((t) => t.customerId === activeDetailsId);

  // Sync edit states when selected customer changes
  React.useEffect(() => {
    if (selectedCustomer) {
      setEditFullName(selectedCustomer.fullName);
      setEditEmail(selectedCustomer.email);
      setEditPhone(selectedCustomer.contactNumber);
      setEditAddress(selectedCustomer.address);
      setEditPlanId(selectedCustomer.currentPlanId);
      setEditFee(selectedCustomer.monthlyFee);
      setEditUsername(selectedCustomer.username || selectedCustomer.email.split("@")[0]);
      setEditBillingStartDate(selectedCustomer.billingStartDate);
      setEditDueDay(String(selectedCustomer.dueDay));
      setIsEditMode(false);
    }
  }, [activeDetailsId, selectedCustomer?.id]);

  const handleEditPlanChange = (planId: string) => {
    setEditPlanId(planId);
    const plan = state.plans.find((p) => p.id === planId);
    if (plan) {
      setEditFee(plan.monthlyPrice);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName || !editAddress || !editPhone || !editEmail) {
      alert("Please fill in all fields.");
      return;
    }

    onUpdateCustomer(selectedCustomer!.id, {
      fullName: editFullName,
      address: editAddress,
      contactNumber: editPhone,
      email: editEmail,
      currentPlanId: editPlanId,
      monthlyFee: Number(editFee),
      username: editUsername || editEmail.split("@")[0],
      billingStartDate: editBillingStartDate || undefined,
      dueDay: editDueDay ? Number(editDueDay) : undefined,
    });

    onAddTimelineEvent(
      selectedCustomer!.id,
      "Profile Updated",
      "Account contact information, address and plan details were updated by Administrator."
    );

    setIsEditMode(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!onDeleteCustomer) return;
    if (!confirm("Delete this customer permanently? This cannot be undone.")) return;
    try {
      await onDeleteCustomer(id);
      if (activeDetailsId === id) {
        setActiveDetailsId(null);
        if (onCloseDetailView) onCloseDetailView();
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete customer.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Customer Profiles
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage fiber connections, track historical events, and review account statuses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setParsedRows([]);
              setImportError("");
              setSuccessCount(null);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0c1222]/50 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-[#0c1222] transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-green-400" />
            Import Spreadsheet
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/20 p-4 shadow-sm flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search by name, ID, phone, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-colors focus:border-blue-500/60 focus:bg-slate-900/70 placeholder:text-slate-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Disconnected">Disconnected</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
          >
            <option value="All">All Plans</option>
            {state.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer List Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Customer ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Internet Plan</th>
                <th className="px-6 py-4">Address & Contact</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Next Due Date</th>
                <th className="px-6 py-4">Billing Status</th>
                <th className="px-6 py-4">Outstanding Balance</th>
                <th className="px-6 py-4">Last Payment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-slate-500">
                    No customers found matching filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const plan = state.plans.find((p) => p.id === cust.currentPlanId);
                  const outstandingBalance = state.invoices
                    .filter((inv) => inv.customerId === cust.id && (inv.status === "Unpaid" || inv.status === "Overdue"))
                    .reduce((sum, inv) => sum + inv.amount, 0);
                  const lastPayment = state.payments
                    .filter((p) => p.customerId === cust.id)
                    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1))[0];
                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-800/10 transition-colors duration-150"
                    >
                      {/* ID */}
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500">
                        {cust.id}
                      </td>
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200">
                          {cust.fullName}
                        </div>
                        <div className="text-xxs text-slate-400 mt-0.5 font-mono">
                          Username: {cust.username || cust.email.split("@")[0]}
                        </div>
                      </td>
                      {/* Plan */}
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-300 block">
                          {plan?.name || "No Plan"}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          ₱{cust.monthlyFee.toFixed(2)}/mo
                        </span>
                      </td>
                      {/* Contact Info */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                          {cust.contactNumber}
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-slate-400 mt-1 whitespace-normal break-words">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500 mt-0.5" />
                          <span className="break-words leading-normal">{cust.address}</span>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${
                            cust.status === "Active"
                              ? "bg-green-500/15 text-green-400"
                              : cust.status === "Suspended"
                              ? "bg-orange-500/15 text-orange-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              cust.status === "Active"
                                ? "bg-green-400"
                                : cust.status === "Suspended"
                                ? "bg-orange-400"
                                : "bg-red-400"
                            }`}
                          />
                          {cust.status}
                        </span>
                      </td>
                      {/* Next Due Date */}
                      <td className="px-6 py-4 text-xs text-slate-300 font-mono whitespace-nowrap">
                        {cust.nextDueDate}
                      </td>
                      {/* Billing Status */}
                      <td className="px-6 py-4">
                        <BillingStatusBadge status={cust.billingStatus} />
                      </td>
                      {/* Outstanding Balance */}
                      <td className="px-6 py-4 text-xs font-mono whitespace-nowrap">
                        {outstandingBalance > 0 ? (
                          <span className="text-red-400 font-semibold">₱{outstandingBalance.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">₱0.00</span>
                        )}
                      </td>
                      {/* Last Payment */}
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {lastPayment ? lastPayment.paymentDate : "—"}
                      </td>
                      {/* Action buttons */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setActiveDetailsId(cust.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 text-xs font-semibold text-slate-300 shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5 text-blue-400" />
                            Edit
                          </button>
                          {onDeleteCustomer && (
                            <button
                              onClick={() => handleDeleteCustomer(cust.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/20 bg-slate-900 px-2.5 text-xs font-semibold text-red-400 shadow-xs hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Drawer: Detailed View */}
      {activeDetailsId && selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="relative w-full max-w-xl bg-[#0c111d] border-l border-slate-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 font-bold text-lg border border-blue-500/20">
                  {selectedCustomer.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100 leading-none">
                    {selectedCustomer.fullName}
                  </h2>
                  <span className="text-xs font-mono font-semibold text-slate-500 mt-1 block">
                    {selectedCustomer.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveDetailsId(null);
                  if (onCloseDetailView) onCloseDetailView();
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Scroller */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Profile Header and Edit Toggle */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Subscriber Profile Details
                </h3>
                {!isEditMode && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-slate-800 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit Profile
                    </button>
                    {onDeleteCustomer && (
                      <button
                        onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Card Info / Edit Form */}
              {isEditMode ? (
                <form onSubmit={handleEditSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-3 py-2 text-xs outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Service Username
                    </label>
                    <input
                      type="text"
                      required
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-3 py-2 text-xs outline-none focus:border-blue-500/60 placeholder:text-slate-600 font-mono"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-3 py-2 text-xs outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-3 py-2 text-xs outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Physical Address
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-3 py-2 text-xs outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                    />
                  </div>

                  {/* Internet Plan and Fee */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Internet Plan
                      </label>
                      <select
                        value={editPlanId}
                        onChange={(e) => handleEditPlanChange(e.target.value)}
                        className="mt-1 w-full h-9 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 px-2.5 text-xs outline-none focus:border-blue-500/60"
                      >
                        {state.plans.filter((p) => p.status === "Active").map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₱{p.monthlyPrice})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Monthly Fee (₱)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={editFee}
                        onChange={(e) => setEditFee(Number(e.target.value))}
                        className="mt-1 w-full h-9 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-3 py-2 text-xs outline-none focus:border-blue-500/60 font-mono"
                      />
                    </div>
                  </div>

                  {/* Billing Schedule */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Monthly Billing Schedule
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Billing Start Date
                        </label>
                        <input
                          type="date"
                          value={editBillingStartDate}
                          onChange={(e) => setEditBillingStartDate(e.target.value)}
                          className="mt-1 w-full h-9 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-2.5 text-xs outline-none focus:border-blue-500/60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Due Day (1-31)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editDueDay}
                          onChange={(e) => setEditDueDay(e.target.value)}
                          className="mt-1 w-full h-9 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 px-2.5 text-xs outline-none focus:border-blue-500/60 font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Changing the billing start date re-derives the due day unless you also set an override above. Next due date and outstanding invoices are not retroactively changed.
                    </p>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="flex items-center gap-2.5 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="flex-1 rounded-xl border border-slate-800 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3.5 text-sm text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <User className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    <span>Username: <strong className="text-slate-200 font-mono">{selectedCustomer.username || selectedCustomer.email.split("@")[0]}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    <span>{selectedCustomer.contactNumber}</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="break-words whitespace-normal leading-relaxed text-slate-300">{selectedCustomer.address}</span>
                  </div>
                  <div className="flex items-center gap-2.5 border-t border-slate-800/60 pt-3">
                    <Calendar className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    <span>Installed: <strong className="text-slate-200">{selectedCustomer.installationDate}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                    <span>Current Plan: <strong className="text-slate-200">{selectedPlan?.name || "None"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-slate-400">Fee:</span>
                    <span className="font-mono font-semibold text-blue-400">₱{selectedCustomer.monthlyFee.toFixed(2)}/mo</span>
                  </div>
                </div>
              )}

              {/* Quick Status Control Panels */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Service Control Action
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={selectedCustomer.status === "Active"}
                    onClick={() => handleStatusChange(selectedCustomer, "Active")}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedCustomer.status === "Active"
                        ? "bg-green-500/10 border-green-500/20 text-green-400 cursor-not-allowed"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Activate
                  </button>
                  <button
                    disabled={selectedCustomer.status === "Suspended"}
                    onClick={() => handleStatusChange(selectedCustomer, "Suspended")}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedCustomer.status === "Suspended"
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400 cursor-not-allowed"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Suspend
                  </button>
                  <button
                    disabled={selectedCustomer.status === "Disconnected"}
                    onClick={() => handleStatusChange(selectedCustomer, "Disconnected")}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedCustomer.status === "Disconnected"
                        ? "bg-red-500/10 border-red-500/20 text-red-400 cursor-not-allowed"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>

              {/* Request Field Service Button */}
              <div>
                <button
                  onClick={() => {
                    onTriggerTaskForCustomer(selectedCustomer);
                    setActiveDetailsId(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  Dispatch Repair Technician / Create Service Task
                </button>
              </div>

              {/* Timeline Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-500" />
                  Customer Timeline History
                </h3>
                <div className="relative pl-4 border-l-2 border-slate-800 ml-2 space-y-5">
                  {customerTimeline.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No historical actions logged for this customer.</p>
                  ) : (
                    customerTimeline.map((item) => (
                      <div key={item.id} className="relative">
                        <div className="absolute -left-[22px] top-1.5 bg-blue-500 h-2.5 w-2.5 rounded-full ring-4 ring-[#0c111d]" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">
                              {item.action}
                            </span>
                            <span className="text-xxs font-mono text-slate-500">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Billing Invoice history */}
              <div className="space-y-3.5 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Associated Billing Invoices
                </h3>
                <div className="space-y-2">
                  {customerInvoices.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No invoices found.</p>
                  ) : (
                    customerInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between border border-slate-800 rounded-xl p-3 bg-slate-900/30 hover:bg-slate-900/60 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-200">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-xxs text-slate-500">
                              ({inv.billingPeriodStart} &rarr; {inv.billingPeriodEnd})
                            </span>
                          </div>
                          <p className="text-xxs text-slate-400 mt-1">
                            Due Date: {inv.dueDate}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="text-xs font-bold text-slate-200 block font-mono">
                              ₱{inv.amount.toFixed(2)}
                            </span>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xxs font-semibold mt-0.5 ${
                              inv.status === "Paid"
                                ? "bg-green-500/15 text-green-400"
                                : inv.status === "Overdue"
                                ? "bg-red-500/15 text-red-400"
                                : inv.status === "Cancelled"
                                ? "bg-slate-800 text-slate-400"
                                : "bg-yellow-500/15 text-yellow-400"
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100">Add New Customer</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              {/* Service Username */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between">
                  <span>Service Username</span>
                  <span className="text-[10px] text-slate-500 font-normal normal-case">Optional (defaults to email username)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. john.doe"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600 font-mono"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              {/* Contact number */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Contact Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +1 (555) 019-1234"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Physical Installation Address
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. 123 Main St, Springfield"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Select Plan */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Internet Plan
                  </label>
                  <select
                    value={newPlanId}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                  >
                    {state.plans.filter((p) => p.status === "Active").map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.monthlyPrice})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Edit Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Monthly Fee ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newFee}
                    onChange={(e) => setNewFee(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 font-mono"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Initial Account Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                >
                  <option value="Active">Active / Installed</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Disconnected">Disconnected</option>
                </select>
              </div>

              {/* Billing schedule */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Monthly Billing Schedule
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Installation Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newInstallationDate}
                      onChange={(e) => setNewInstallationDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Billing Start Date
                    </label>
                    <input
                      type="date"
                      placeholder={newInstallationDate}
                      value={newBillingStartDate}
                      onChange={(e) => setNewBillingStartDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">Defaults to installation date if left blank.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Due Day Override (1-31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Auto from billing start date"
                    value={newDueDayOverride}
                    onChange={(e) => setNewDueDayOverride(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 text-slate-100 px-3 py-2 text-sm outline-none focus:border-blue-500/60 font-mono"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Leave blank to bill every month on the day-of-month of the billing start date.
                  </p>
                </div>
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
                  Create Subscriber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spreadsheet Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0c111d] p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-400" />
                <h2 className="text-lg font-bold text-slate-100">Import Customers from Spreadsheet</h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setParsedRows([]);
                  setImportError("");
                  setSuccessCount(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error message */}
            {importError && (
              <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-400 flex items-start gap-2 shrink-0">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Error:</span> {importError}
                </div>
              </div>
            )}

            {/* Success Success Message */}
            {successCount !== null && (
              <div className="mt-4 flex flex-col items-center justify-center py-12 text-center space-y-4 flex-1">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-400 border border-green-500/25 animate-bounce">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Import Completed!</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Successfully imported <strong className="text-green-400 font-mono text-base">{successCount}</strong> customer profiles.
                  </p>
                </div>
              </div>
            )}

            {successCount === null && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1 min-h-[300px]">
                {parsedRows.length === 0 ? (
                  <div className="space-y-4 py-4">
                    {/* Instructions and Download button */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-slate-300">
                      <div>
                        <p className="font-bold text-slate-200">How to prepare your file:</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Your spreadsheet must contain headers for <strong>Full Name</strong>, <strong>Email</strong>, <strong>Contact Number</strong>, and <strong>Address</strong>. Columns like <strong>Plan ID</strong>, <strong>Monthly Fee</strong>, and <strong>Status</strong> are optional (will fallback to active defaults).
                        </p>
                      </div>
                      <button
                        onClick={downloadSampleTemplate}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-slate-900 transition-colors shrink-0 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 rotate-180" />
                        Download CSV Template
                      </button>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer ${
                        isDragOver
                          ? "border-blue-500 bg-blue-500/5"
                          : "border-slate-800 bg-slate-900/10 hover:border-slate-700 hover:bg-slate-900/20"
                      }`}
                    >
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-4 border border-slate-700">
                        <Upload className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-200">
                        Drag and drop your spreadsheet file here
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) formats
                      </p>
                      <button className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 pointer-events-none">
                        Browse files
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary statistics */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-center">
                        <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider block">Total Rows Detected</span>
                        <span className="text-xl font-mono font-bold text-slate-200 block mt-1">{parsedRows.length}</span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-center">
                        <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider block">Ready to Import</span>
                        <span className="text-xl font-mono font-bold text-green-400 block mt-1">
                          {parsedRows.filter(r => r.errors.length === 0).length}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-center">
                        <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider block">Skipped with Errors</span>
                        <span className="text-xl font-mono font-bold text-red-400 block mt-1">
                          {parsedRows.filter(r => r.errors.length > 0).length}
                        </span>
                      </div>
                    </div>

                    {/* Preview list table */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                      <div className="overflow-x-auto max-h-72">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="py-2.5 px-3 w-12 text-center">Row</th>
                              <th className="py-2.5 px-3">Full Name</th>
                              <th className="py-2.5 px-3">Email</th>
                              <th className="py-2.5 px-3">Phone</th>
                              <th className="py-2.5 px-3">Address</th>
                              <th className="py-2.5 px-3">Plan / Fee</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Validation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-xs">
                            {parsedRows.map((row) => (
                              <tr key={row.rowNum} className={row.errors.length > 0 ? "bg-red-500/5" : "hover:bg-slate-900/20"}>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">{row.rowNum}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-200">{row.fullName || <span className="text-red-500 italic">Empty</span>}</td>
                                <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{row.email || <span className="text-red-500 italic">Empty</span>}</td>
                                <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{row.contactNumber || <span className="text-red-500 italic">Empty</span>}</td>
                                <td className="py-2.5 px-3 text-slate-400 max-w-[180px] break-words whitespace-normal leading-relaxed">{row.address || <span className="text-red-500 italic">Empty</span>}</td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  <div className="font-mono text-[11px]">
                                    {row.currentPlanId}
                                  </div>
                                  <div className="text-[10px] text-blue-400 font-mono mt-0.5">
                                    ₱{row.monthlyFee.toFixed(2)}/mo
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                    row.status === "Active"
                                      ? "bg-green-500/10 text-green-400"
                                      : row.status === "Suspended"
                                      ? "bg-yellow-500/10 text-yellow-400"
                                      : "bg-red-500/10 text-red-400"
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {row.errors.length === 0 ? (
                                    <span className="inline-flex items-center gap-0.5 rounded-md bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                                      ✓ Ready
                                    </span>
                                  ) : (
                                    <div className="flex flex-col items-end gap-0.5">
                                      {row.errors.map((err, i) => (
                                        <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
                                          {err}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Actions */}
            {successCount === null && (
              <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4 shrink-0">
                {parsedRows.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setParsedRows([])}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                  >
                    Upload different file
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setParsedRows([]);
                      setImportError("");
                      setSuccessCount(null);
                    }}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>

                  {parsedRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportSubmit}
                      disabled={parsedRows.filter(r => r.errors.length === 0).length === 0}
                      className="rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-green-500/10"
                    >
                      Import {parsedRows.filter(r => r.errors.length === 0).length} Valid Customers
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
