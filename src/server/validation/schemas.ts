import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const customerCreateSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  address: z.string().min(1, "Address is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  email: z.string().email("Must be a valid email"),
  installationDate: z.string().min(1, "Installation date is required"),
  currentPlanId: z.string().min(1, "A plan must be selected"),
  monthlyFee: z.number().positive().optional(),
  status: z.enum(["Active", "Suspended", "Disconnected"]).default("Active"),
  username: z.string().optional(),
  // Billing schedule - billingStartDate defaults to installationDate and
  // dueDay is derived from it server-side when omitted (see
  // customers.routes.ts), so both are optional on input.
  billingStartDate: z.string().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
});
export const customerUpdateSchema = customerCreateSchema.partial();

export const planCreateSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  speed: z.string().min(1, "Speed is required"),
  monthlyPrice: z.number().positive("Monthly price must be greater than 0"),
  description: z.string().default(""),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
export const planUpdateSchema = planCreateSchema.partial();

export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  billingPeriodStart: z.string().min(1, "Billing period start is required"),
  billingPeriodEnd: z.string().min(1, "Billing period end is required"),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  status: z.enum(["Unpaid", "Paid", "Overdue", "Cancelled"]).default("Unpaid"),
  paymentDate: z.string().optional(),
  paymentMethod: z
    .enum(["Cash", "Bank Transfer", "Credit Card", "Mobile Wallet", "Other"])
    .optional(),
  notes: z.string().optional(),
});
export const invoiceUpdateSchema = invoiceCreateSchema.partial();

export const invoicePaymentSchema = z.object({
  paymentMethod: z.enum(["Cash", "Bank Transfer", "Credit Card", "Mobile Wallet", "Other"]),
  paymentDate: z.string().optional(),
  amount: z.number().positive().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const expenseCreateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  vendor: z.string().min(1, "Vendor is required"),
  description: z.string().default(""),
  receiptImage: z.string().optional(),
});
export const expenseUpdateSchema = expenseCreateSchema.partial();

export const technicianCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Must be a valid email"),
  position: z.string().default(""),
  status: z.enum(["Active", "On Leave", "Inactive"]).default("Active"),
  joinedDate: z.string().min(1, "Joined date is required"),
  profilePicture: z.string().default(""),
  // Optional: create a login account for this technician at the same time
  username: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});
export const technicianUpdateSchema = technicianCreateSchema
  .omit({ username: true, password: true })
  .partial();

export const taskCreateSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  assignedTechnicianId: z.string().optional().nullable(),
  priority: z.enum(["Low", "Medium", "High", "Emergency"]).default("Medium"),
  description: z.string().min(1, "Description is required"),
  address: z.string().min(1, "Address is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  estimatedDuration: z.string().default(""),
  status: z
    .enum(["Pending", "Assigned", "On The Way", "In Progress", "Completed", "Cancelled"])
    .default("Pending"),
});
export const taskUpdateSchema = taskCreateSchema.partial();

export const taskStatusUpdateSchema = z.object({
  status: z.enum([
    "Pending",
    "Assigned",
    "On The Way",
    "In Progress",
    "Completed",
    "Cancelled",
  ]),
});

export const taskCompletionSchema = z.object({
  problemFound: z.string().min(1, "Required"),
  workPerformed: z.string().min(1, "Required"),
  materialsUsed: z.string().default(""),
  additionalRecommendation: z.string().default(""),
  completionTime: z.string().min(1, "Required"),
  customerConfirmation: z.boolean().default(false),
  photoUrl: z.string().optional(),
});

export const taskNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});
