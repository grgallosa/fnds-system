export type UserRole = "ADMIN" | "TECHNICIAN";

export type BillingStatus = "Current" | "Due Soon" | "Overdue";

export interface Customer {
  id: string; // e.g. CUST-1001
  fullName: string;
  address: string;
  contactNumber: string;
  email: string;
  installationDate: string;
  currentPlanId: string;
  monthlyFee: number;
  status: "Active" | "Suspended" | "Disconnected";
  username?: string;
  // --- Recurring monthly billing schedule ---
  billingStartDate: string;
  dueDay: number;
  nextDueDate: string;
  billingStatus: BillingStatus;
}

export interface CustomerTimelineEvent {
  id: string;
  customerId: string;
  timestamp: string;
  action: string;
  description: string;
  icon?: string;
}

export interface InternetPlan {
  id: string; // e.g. PLAN-1
  name: string;
  speed: string; // e.g. "50 Mbps" or "100 Mbps"
  monthlyPrice: number;
  description: string;
  status: "Active" | "Inactive";
}

export interface Invoice {
  id: string; // internal id, e.g. INV-2026-9F3A2C
  invoiceNumber: string; // e.g. INV-2026-0001
  customerId: string;
  customerName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  amount: number;
  status: "Unpaid" | "Paid" | "Overdue" | "Cancelled";
  paymentDate?: string;
  paymentMethod?: "Cash" | "Bank Transfer" | "Credit Card" | "Mobile Wallet" | "Other";
  notes?: string;
}

export interface Payment {
  id: string; // e.g. PAY-1001
  invoiceId: string;
  customerId: string;
  customerName?: string;
  paymentDate: string;
  amount: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Credit Card" | "Mobile Wallet" | "Other";
  referenceNumber?: string;
  notes?: string;
}

export interface Expense {
  id: string; // e.g. EXP-1001
  date: string;
  category: string;
  amount: number;
  vendor: string;
  description: string;
  receiptImage?: string; // Optional URL or base64
  recordedBy: string;
}

export interface Technician {
  id: string; // e.g. TECH-201
  name: string;
  phone: string;
  email: string;
  position: string;
  status: "Active" | "On Leave" | "Inactive";
  profilePicture: string; // Initials or URL
  joinedDate: string;
}

export interface CompletionNotes {
  problemFound: string;
  workPerformed: string;
  materialsUsed: string;
  additionalRecommendation: string;
  completionTime: string;
  customerConfirmation: boolean;
  photoUrl?: string;
}

export interface RepairTask {
  id: string; // e.g. TASK-1001
  customerId: string;
  customerName: string;
  assignedTechnicianId: string;
  priority: "Low" | "Medium" | "High" | "Emergency";
  description: string;
  address: string;
  dateCreated: string;
  scheduledDate: string;
  estimatedDuration: string;
  status: "Pending" | "Assigned" | "On The Way" | "In Progress" | "Completed" | "Cancelled";
  completionDate?: string;
  completionNotes?: CompletionNotes;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  role: "Administrator" | "Technician";
  action: string;
  affectedRecord: string;
  ipAddress: string;
  device: string;
}

export interface AuditRecord {
  id: string;
  user: string;
  action: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
  device: string;
}

export interface SystemNotification {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  category: "invoice" | "task" | "expense" | "payment" | "customer";
  read: boolean;
  forRole: UserRole;
  targetId?: string; // e.g. ID of task or invoice
}

export interface AppState {
  role: "ADMIN" | "TECHNICIAN";
  activeTechnicianId: string; // Current logged-in technician
  customers: Customer[];
  plans: InternetPlan[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  technicians: Technician[];
  tasks: RepairTask[];
  timelines: CustomerTimelineEvent[];
  activityLogs: ActivityLog[];
  auditRecords: AuditRecord[];
  notifications: SystemNotification[];
}

