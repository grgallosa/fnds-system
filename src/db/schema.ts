import {
  pgTable,
  text,
  timestamp,
  serial,
  integer,
  numeric,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "TECHNICIAN"]);
export const customerStatusEnum = pgEnum("customer_status", [
  "Active",
  "Suspended",
  "Disconnected",
]);
export const planStatusEnum = pgEnum("plan_status", ["Active", "Inactive"]);
// "Unpaid" replaces the old "Pending" label to match standard invoicing
// terminology. Distinct from billing_status below, which is a customer-level
// rollup rather than a per-invoice status.
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "Unpaid",
  "Paid",
  "Overdue",
  "Cancelled",
]);
// Customer-level rollup of standing relative to their next due date -
// shown as a colored badge throughout the app.
export const billingStatusEnum = pgEnum("billing_status", [
  "Current",
  "Due Soon",
  "Overdue",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "Cash",
  "Bank Transfer",
  "Credit Card",
  "Mobile Wallet",
  "Other",
]);
export const technicianStatusEnum = pgEnum("technician_status", [
  "Active",
  "On Leave",
  "Inactive",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "Low",
  "Medium",
  "High",
  "Emergency",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "Pending",
  "Assigned",
  "On The Way",
  "In Progress",
  "Completed",
  "Cancelled",
]);
export const logRoleEnum = pgEnum("log_role", ["Administrator", "Technician"]);
export const notificationCategoryEnum = pgEnum("notification_category", [
  "invoice",
  "task",
  "expense",
  "payment",
  "customer",
]);

// ---------------------------------------------------------------------------
// Users / Auth
// One row per login account. Admins log in directly. Technicians log in
// through the same table, linked 1:1 to a row in `technicians` via
// technicians.userId. Role is enforced server-side on every request -
// it is NEVER trusted from the client.
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("TECHNICIAN"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// ---------------------------------------------------------------------------
// Internet Plans
// ---------------------------------------------------------------------------
export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // e.g. PLAN-1
  name: text("name").notNull(),
  speed: text("speed").notNull(),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  status: planStatusEnum("status").notNull().default("Active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(), // e.g. CUST-1001
    fullName: text("full_name").notNull(),
    address: text("address").notNull(),
    contactNumber: text("contact_number").notNull(),
    email: text("email").notNull(),
    installationDate: text("installation_date").notNull(),
    currentPlanId: text("current_plan_id").references(() => plans.id, {
      onDelete: "restrict",
    }),
    monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).notNull(),
    status: customerStatusEnum("status").notNull().default("Active"),
    username: text("username"),

    // --- Recurring monthly billing schedule -----------------------------
    // The date the customer's monthly billing cycle begins (usually the
    // installation/activation date). The day-of-month of this date is the
    // customer's recurring "due day" every month going forward.
    billingStartDate: text("billing_start_date").notNull(),
    // 1-31. Normally derived from billingStartDate, but stored explicitly so
    // it can be overridden independently (e.g. an admin wants billing on the
    // 1st regardless of when the customer was actually installed).
    dueDay: integer("due_day").notNull(),
    // The next date this customer owes a payment. Advances automatically
    // (by one month, clamped to short months) every time their current
    // invoice is marked Paid.
    nextDueDate: text("next_due_date").notNull(),
    // Rollup of standing relative to nextDueDate, recomputed by the billing
    // scheduler/service rather than trusted from client input.
    billingStatus: billingStatusEnum("billing_status").notNull().default("Current"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Targeted indexes for the hot billing/report query patterns (see
    // reports.routes.ts, billing.service.ts). Added via `npm run db:push` -
    // fine as a blocking operation at this table's current size; if this
    // table ever grows into the millions of rows, create these manually
    // with `CREATE INDEX CONCURRENTLY` instead so the table isn't locked.
    nextDueDateIdx: index("customers_next_due_date_idx").on(table.nextDueDate),
    statusIdx: index("customers_status_idx").on(table.status),
    billingStatusIdx: index("customers_billing_status_idx").on(table.billingStatus),
  })
);

// ---------------------------------------------------------------------------
// Technicians
// ---------------------------------------------------------------------------
export const technicians = pgTable("technicians", {
  id: text("id").primaryKey(), // e.g. TECH-201
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  position: text("position").notNull().default(""),
  status: technicianStatusEnum("status").notNull().default("Active"),
  profilePicture: text("profile_picture").notNull().default(""),
  joinedDate: text("joined_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(), // internal id, e.g. INV-2026-9F3A2C
    // Human-facing, sequential-per-year invoice number, e.g. INV-2026-0001.
    // Kept separate from `id` so display numbering can stay sequential even
    // though the primary key itself is a collision-safe random token.
    invoiceNumber: text("invoice_number").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    billingPeriodStart: text("billing_period_start").notNull(),
    billingPeriodEnd: text("billing_period_end").notNull(),
    dueDate: text("due_date").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: invoiceStatusEnum("status").notNull().default("Unpaid"),
    paymentDate: text("payment_date"),
    paymentMethod: paymentMethodEnum("payment_method"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    invoiceNumberUnique: uniqueIndex("invoices_invoice_number_unique").on(
      table.invoiceNumber
    ),
    // Closes the TOCTOU race in createInvoiceForCycle's select-then-insert:
    // guarantees at most one invoice per customer per due date at the DB
    // level, not just in application code. See
    // src/server/migrations/add-invoice-cycle-unique-index.ts for the
    // one-time migration that adds this safely on a populated table, and
    // billing.service.ts#createInvoiceForCycle for the unique-violation
    // handling that treats a conflict here as "already exists".
    customerDueDateUnique: uniqueIndex("invoices_customer_id_due_date_unique").on(
      table.customerId,
      table.dueDate
    ),
    statusIdx: index("invoices_status_idx").on(table.status),
    dueDateIdx: index("invoices_due_date_idx").on(table.dueDate),
    customerIdIdx: index("invoices_customer_id_idx").on(table.customerId),
  })
);

// ---------------------------------------------------------------------------
// Payments
// One row per payment actually received against an invoice. Never deleted
// (see business rule: payment history must never be deleted) - invoices can
// be cancelled, but a recorded payment stands as a permanent audit record.
// ---------------------------------------------------------------------------
export const payments = pgTable("payments", {
  id: text("id").primaryKey(), // e.g. PAY-1001
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "restrict" }),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  paymentDate: text("payment_date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  referenceNumber: text("reference_number"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(), // e.g. EXP-1001
  date: text("date").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  vendor: text("vendor").notNull(),
  description: text("description").notNull().default(""),
  receiptImage: text("receipt_image"),
  recordedByUserId: text("recorded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  recordedBy: text("recorded_by").notNull(), // display name snapshot
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Repair Tasks (+ completion notes, 1:1)
// ---------------------------------------------------------------------------
export const repairTasks = pgTable("repair_tasks", {
  id: text("id").primaryKey(), // e.g. TASK-1001
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  assignedTechnicianId: text("assigned_technician_id").references(
    () => technicians.id,
    { onDelete: "set null" }
  ),
  priority: taskPriorityEnum("priority").notNull().default("Medium"),
  description: text("description").notNull(),
  address: text("address").notNull(),
  dateCreated: text("date_created").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  estimatedDuration: text("estimated_duration").notNull().default(""),
  status: taskStatusEnum("status").notNull().default("Pending"),
  completionDate: text("completion_date"),
  // Completion notes (flattened, nullable until task is completed)
  problemFound: text("problem_found"),
  workPerformed: text("work_performed"),
  materialsUsed: text("materials_used"),
  additionalRecommendation: text("additional_recommendation"),
  completionTime: text("completion_time"),
  customerConfirmation: boolean("customer_confirmation").default(false),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Customer timeline events
// ---------------------------------------------------------------------------
export const customerTimelineEvents = pgTable("customer_timeline_events", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
});

// ---------------------------------------------------------------------------
// Activity logs & audit records
// ---------------------------------------------------------------------------
export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  role: logRoleEnum("role").notNull(),
  action: text("action").notNull(),
  affectedRecord: text("affected_record").notNull(),
  ipAddress: text("ip_address").notNull().default(""),
  device: text("device").notNull().default(""),
});

export const auditRecords = pgTable("audit_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  previousValue: text("previous_value").notNull().default(""),
  newValue: text("new_value").notNull().default(""),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  device: text("device").notNull().default(""),
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: notificationCategoryEnum("category").notNull(),
  read: boolean("read").notNull().default(false),
  forRole: userRoleEnum("for_role").notNull(),
  targetId: text("target_id"),
});

// ---------------------------------------------------------------------------
// Relations (for query API / joins)
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one }) => ({
  technicianProfile: one(technicians, {
    fields: [users.id],
    references: [technicians.userId],
  }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  customers: many(customers),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  plan: one(plans, {
    fields: [customers.currentPlanId],
    references: [plans.id],
  }),
  invoices: many(invoices),
  payments: many(payments),
  tasks: many(repairTasks),
  timelineEvents: many(customerTimelineEvents),
}));

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  user: one(users, {
    fields: [technicians.userId],
    references: [users.id],
  }),
  tasks: many(repairTasks),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}));

export const repairTasksRelations = relations(repairTasks, ({ one }) => ({
  customer: one(customers, {
    fields: [repairTasks.customerId],
    references: [customers.id],
  }),
  technician: one(technicians, {
    fields: [repairTasks.assignedTechnicianId],
    references: [technicians.id],
  }),
}));

export const customerTimelineEventsRelations = relations(
  customerTimelineEvents,
  ({ one }) => ({
    customer: one(customers, {
      fields: [customerTimelineEvents.customerId],
      references: [customers.id],
    }),
  })
);

// ---------------------------------------------------------------------------
// Inferred row types - convenience re-exports so server modules (services,
// routes) don't each need their own `typeof table.$inferSelect` boilerplate.
// ---------------------------------------------------------------------------
export type Customer = typeof customers.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
