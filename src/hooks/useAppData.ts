import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  AppState,
  Customer,
  InternetPlan,
  Invoice,
  Payment,
  Expense,
  Technician,
  RepairTask,
  CompletionNotes,
  SystemNotification,
  ActivityLog,
  AuditRecord,
  CustomerTimelineEvent,
} from "../types";

export interface BillingSummary {
  dueToday: number;
  dueThisWeek: number;
  overdueCustomers: number;
  totalOutstandingBalance: number;
  expectedMonthlyRevenue: number;
  collectedRevenueThisMonth: number;
}

// --- Server row -> frontend type mappers ------------------------------
// Postgres NUMERIC columns come back as strings over the wire; the
// frontend types expect numbers, so we normalize here in one place.

function mapPlan(row: any): InternetPlan {
  return { ...row, monthlyPrice: Number(row.monthlyPrice) };
}
function mapCustomer(row: any): Customer {
  return { ...row, monthlyFee: Number(row.monthlyFee), dueDay: Number(row.dueDay) };
}
function mapInvoice(row: any): Invoice {
  return { ...row, amount: Number(row.amount) };
}
function mapPayment(row: any): Payment {
  return { ...row, amount: Number(row.amount) };
}
function mapExpense(row: any): Expense {
  return { ...row, amount: Number(row.amount) };
}
function mapActivityLog(row: any): ActivityLog {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp).toISOString(),
    user: row.userName,
    role: row.role,
    action: row.action,
    affectedRecord: row.affectedRecord,
    ipAddress: row.ipAddress,
    device: row.device,
  };
}
function mapAuditRecord(row: any): AuditRecord {
  return {
    id: row.id,
    user: row.userName,
    action: row.action,
    previousValue: row.previousValue,
    newValue: row.newValue,
    timestamp: new Date(row.timestamp).toISOString(),
    device: row.device,
  };
}
function mapTimelineEvent(row: any): CustomerTimelineEvent {
  return { ...row, timestamp: new Date(row.timestamp).toISOString() };
}
function mapNotification(row: any): SystemNotification {
  return { ...row, timestamp: new Date(row.timestamp).toISOString() };
}
function mapTask(row: any, customersList: Customer[] = []): RepairTask {
  const completionNotes: CompletionNotes | undefined = row.problemFound
    ? {
        problemFound: row.problemFound,
        workPerformed: row.workPerformed,
        materialsUsed: row.materialsUsed,
        additionalRecommendation: row.additionalRecommendation,
        completionTime: row.completionTime,
        customerConfirmation: row.customerConfirmation,
        photoUrl: row.photoUrl,
      }
    : undefined;
  const customerName =
    row.customerName || customersList.find((c) => c.id === row.customerId)?.fullName || "";
  return { ...row, customerName, completionNotes };
}

export function useAppData() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<InternetPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tasks, setTasks] = useState<RepairTask[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [timelines, setTimelines] = useState<CustomerTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const refetchAll = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [customersRes, plansRes, techsRes, tasksRes, notifsRes] = await Promise.all([
        api.get<any[]>("/customers"),
        api.get<any[]>("/plans"),
        isAdmin ? api.get<any[]>("/technicians") : Promise.resolve([]),
        api.get<any[]>("/tasks"),
        api.get<any[]>("/notifications"),
      ]);
      const mappedCustomers = customersRes.map(mapCustomer);
      setCustomers(mappedCustomers);
      setPlans(plansRes.map(mapPlan));
      setTechnicians(techsRes.map((t) => t as Technician));
      setTasks(tasksRes.map((row) => mapTask(row, mappedCustomers)));
      setNotifications(notifsRes.map(mapNotification));

      if (isAdmin) {
        const [invoicesRes, expensesRes, activityRes, auditRes, timelineRes, paymentsRes, billingSummaryRes] =
          await Promise.all([
            api.get<any[]>("/invoices"),
            api.get<any[]>("/expenses"),
            api.get<any[]>("/logs/activity"),
            api.get<any[]>("/logs/audit"),
            api.get<any[]>("/timeline"),
            api.get<any[]>("/payments"),
            api.get<BillingSummary>("/reports/billing-summary"),
          ]);
        setInvoices(invoicesRes.map(mapInvoice));
        setExpenses(expensesRes.map(mapExpense));
        setActivityLogs(activityRes.map(mapActivityLog));
        setAuditRecords(auditRes.map(mapAuditRecord));
        setTimelines(timelineRes.map(mapTimelineEvent));
        setPayments(paymentsRes.map(mapPayment));
        setBillingSummary(billingSummaryRes);
      }
      setIsConnected(true);
    } catch (err) {
      console.error("Failed to load data from API:", err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin]);

  // For a technician, we still need to resolve their own technician profile
  // (name, id) even though the full technician list is admin-only.
  const [ownTechnician, setOwnTechnician] = useState<Technician | null>(null);
  useEffect(() => {
    if (user?.role === "TECHNICIAN" && user.technicianId) {
      api
        .get<Technician>(`/technicians/${user.technicianId}`)
        .then(setOwnTechnician)
        .catch(() => setOwnTechnician(null));
    }
  }, [user]);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  const state: AppState = {
    role: user?.role || "ADMIN",
    activeTechnicianId: user?.technicianId || "",
    customers,
    plans,
    invoices,
    payments,
    expenses,
    technicians: isAdmin ? technicians : ownTechnician ? [ownTechnician] : [],
    tasks,
    timelines,
    activityLogs,
    auditRecords,
    notifications,
  };

  // --- Customers -------------------------------------------------------
  // nextDueDate and billingStatus are always computed server-side; billing
  // start date/due day are optional overrides the form may supply.
  const addCustomer = async (
    payload: Omit<Customer, "id" | "nextDueDate" | "billingStatus" | "billingStartDate" | "dueDay"> &
      Partial<Pick<Customer, "billingStartDate" | "dueDay">>
  ) => {
    const created = await api.post<any>("/customers", payload);
    setCustomers((prev) => [...prev, mapCustomer(created)]);
  };
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const updated = await api.put<any>(`/customers/${id}`, updates);
    setCustomers((prev) => prev.map((c) => (c.id === id ? mapCustomer(updated) : c)));
  };
  const deleteCustomer = async (id: string) => {
    await api.del(`/customers/${id}`);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };
  const addTimelineEvent = async (customerId: string, action: string, description: string) => {
    const created = await api.post<any>("/timeline", {
      customerId,
      action,
      description,
    });
    setTimelines((prev) => [mapTimelineEvent(created), ...prev]);
  };

  // --- Plans -------------------------------------------------------------
  const addPlan = async (payload: Omit<InternetPlan, "id">) => {
    const created = await api.post<any>("/plans", payload);
    setPlans((prev) => [...prev, mapPlan(created)]);
  };
  const updatePlan = async (id: string, updates: Partial<InternetPlan>) => {
    const updated = await api.put<any>(`/plans/${id}`, updates);
    setPlans((prev) => prev.map((p) => (p.id === id ? mapPlan(updated) : p)));
  };
  const deletePlan = async (id: string) => {
    await api.del(`/plans/${id}`);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  // --- Invoices ----------------------------------------------------------
  const addInvoice = async (payload: Omit<Invoice, "id" | "invoiceNumber">) => {
    const created = await api.post<any>("/invoices", payload);
    setInvoices((prev) => [...prev, mapInvoice(created)]);
  };
  const recordPayment = async (
    id: string,
    paymentMethod: NonNullable<Invoice["paymentMethod"]>,
    details?: { paymentDate?: string; referenceNumber?: string; notes?: string }
  ) => {
    const result = await api.post<any>(`/invoices/${id}/pay`, {
      paymentMethod,
      ...details,
    });
    setInvoices((prev) => {
      const withPaid = prev.map((i) => (i.id === id ? mapInvoice(result.invoice) : i));
      // The payment flow also generates next month's invoice - splice it in
      // if one was created, rather than waiting for a full refetch.
      if (result.nextInvoice && !withPaid.some((i) => i.id === result.nextInvoice.id)) {
        return [...withPaid, mapInvoice(result.nextInvoice)];
      }
      return withPaid;
    });
    if (result.customer) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === result.customer.id ? mapCustomer(result.customer) : c))
      );
    }
    // Refetch payments + billing summary rather than reconstruct the
    // payment row client-side (the server is the source of truth for the
    // generated payment id/timestamps).
    const [paymentsRes, billingSummaryRes] = await Promise.all([
      api.get<any[]>("/payments"),
      api.get<BillingSummary>("/reports/billing-summary"),
    ]);
    setPayments(paymentsRes.map(mapPayment));
    setBillingSummary(billingSummaryRes);
  };
  const cancelInvoice = async (id: string) => {
    const updated = await api.put<any>(`/invoices/${id}`, { status: "Cancelled" });
    setInvoices((prev) => prev.map((i) => (i.id === id ? mapInvoice(updated) : i)));
  };
  const generateMonthlyInvoices = async () => {
    const result = await api.post<{ generated: number }>("/invoices/generate-monthly");
    await refetchAll();
    return result.generated;
  };

  // --- Expenses ------------------------------------------------------------
  const addExpense = async (payload: Omit<Expense, "id" | "recordedBy">) => {
    const created = await api.post<any>("/expenses", payload);
    setExpenses((prev) => [mapExpense(created), ...prev]);
  };

  // --- Technicians -----------------------------------------------------
  const addTechnician = async (payload: Omit<Technician, "id">) => {
    const created = await api.post<any>("/technicians", payload);
    setTechnicians((prev) => [...prev, created]);
  };
  const updateTechnician = async (id: string, updates: Partial<Technician>) => {
    const updated = await api.put<any>(`/technicians/${id}`, updates);
    setTechnicians((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };
  const updateTechnicianStatus = async (id: string, status: Technician["status"]) => {
    await updateTechnician(id, { status });
  };
  const deleteTechnician = async (id: string) => {
    await api.del(`/technicians/${id}`);
    setTechnicians((prev) => prev.filter((t) => t.id !== id));
  };
  const setTechnicianCredentials = async (id: string, username: string, password: string) => {
    await api.put(`/technicians/${id}/credentials`, { username, password });
  };

  // --- Repair Tasks ------------------------------------------------------
  const addTask = async (payload: Omit<RepairTask, "id" | "dateCreated">) => {
    const created = await api.post<any>("/tasks", payload);
    setTasks((prev) => [mapTask(created, customers), ...prev]);
  };
  const updateTask = async (id: string, updates: Partial<RepairTask>) => {
    const updated = await api.put<any>(`/tasks/${id}`, updates);
    setTasks((prev) => prev.map((t) => (t.id === id ? mapTask(updated, customers) : t)));
  };
  const deleteTask = async (id: string) => {
    await api.del(`/tasks/${id}`);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };
  const updateTaskStatus = async (id: string, status: RepairTask["status"]) => {
    const updated = await api.patch<any>(`/tasks/${id}/status`, { status });
    setTasks((prev) => prev.map((t) => (t.id === id ? mapTask(updated, customers) : t)));
  };
  const addTaskCompletion = async (id: string, notes: CompletionNotes) => {
    const updated = await api.post<any>(`/tasks/${id}/complete`, notes);
    setTasks((prev) => prev.map((t) => (t.id === id ? mapTask(updated, customers) : t)));
  };
  const addTaskNote = async (id: string, note: string) => {
    await api.post(`/tasks/${id}/notes`, { note });
  };

  // --- Notifications -------------------------------------------------------
  const markNotificationRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };
  const clearAllNotifications = async () => {
    await Promise.all(
      notifications.filter((n) => !n.read).map((n) => api.patch(`/notifications/${n.id}/read`))
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return {
    state,
    isLoading,
    isConnected,
    billingSummary,
    refetchAll,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addTimelineEvent,
    addPlan,
    updatePlan,
    deletePlan,
    addInvoice,
    recordPayment,
    cancelInvoice,
    generateMonthlyInvoices,
    addExpense,
    addTechnician,
    updateTechnician,
    updateTechnicianStatus,
    deleteTechnician,
    setTechnicianCredentials,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    addTaskCompletion,
    addTaskNote,
    markNotificationRead,
    clearAllNotifications,
  };
}
