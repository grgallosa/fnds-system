/**
 * Core business logic for the recurring monthly billing system. Routes stay
 * thin (HTTP concerns only) and call into this module for anything that
 * touches billing rules, so the logic exists in exactly one place.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { customers, invoices, payments, Customer, Invoice } from "../../db/schema.ts";
import { ids } from "../utils/ids.ts";
import {
  computeBillingPeriod,
  computeBillingStatus,
  computeNextDueDate,
  todayStr,
} from "../utils/billing.ts";

/**
 * Sequential-per-year human invoice number, e.g. INV-2026-0001. Not
 * perfectly race-free under heavy concurrent writes (a COUNT-then-insert
 * has a tiny TOCTOU window), but collisions are guarded by a unique index
 * on invoice_number, and monthly-cadence invoice generation for a few
 * thousand customers never approaches the concurrency where that matters.
 */
export async function generateInvoiceNumber(year: number): Promise<string> {
  const prefix = `INV-${year}-`;
  const [{ count }] = await db
    .select({ count: sql<string>`count(*)` })
    .from(invoices)
    .where(sql`${invoices.invoiceNumber} like ${prefix + "%"}`);
  const seq = Number(count) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Creates one invoice for a customer's given due-date cycle, unless one
 * already exists for that exact due date (idempotent - safe to call
 * repeatedly from the scheduler without double-billing).
 */
export async function createInvoiceForCycle(
  customer: Customer,
  dueDate: string,
  isFirstInvoice: boolean
): Promise<Invoice | null> {
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.customerId, customer.id), eq(invoices.dueDate, dueDate)));
  if (existing) return null;

  const { billingPeriodStart, billingPeriodEnd } = computeBillingPeriod(
    dueDate,
    customer.dueDay,
    isFirstInvoice,
    customer.billingStartDate
  );
  const year = new Date(dueDate).getUTCFullYear();
  const invoiceNumber = await generateInvoiceNumber(year);

  const [created] = await db
    .insert(invoices)
    .values({
      id: ids.invoice(),
      invoiceNumber,
      customerId: customer.id,
      billingPeriodStart,
      billingPeriodEnd,
      dueDate,
      amount: customer.monthlyFee,
      status: "Unpaid",
    })
    .returning();
  return created;
}

/**
 * Generates the first invoice for a brand-new Active customer, for their
 * billing start date cycle. Called right after customer creation.
 */
export async function generateFirstInvoiceForCustomer(customer: Customer) {
  if (customer.status !== "Active") return null;
  return createInvoiceForCycle(customer, customer.nextDueDate, true);
}

/**
 * Generates the next month's invoice for every Active customer whose
 * current billing cycle doesn't have an invoice yet. Only fires for
 * customers due today or already past due, so this can safely be re-run on
 * every scheduler tick without generating invoices far in advance.
 *
 * Suspended/Disconnected customers are skipped entirely (business rule:
 * only Active customers receive new invoices).
 */
export async function generateMonthlyInvoicesForActiveCustomers(): Promise<number> {
  const today = todayStr();
  const activeCustomers = await db
    .select()
    .from(customers)
    .where(and(eq(customers.status, "Active"), sql`${customers.nextDueDate} <= ${today}`));

  let generated = 0;
  for (const customer of activeCustomers) {
    const created = await createInvoiceForCycle(customer, customer.nextDueDate, false);
    if (created) generated += 1;
  }
  return generated;
}

/** Marks any Unpaid invoice past its due date as Overdue. */
export async function markOverdueInvoices(): Promise<number> {
  const today = todayStr();
  const overdue = await db
    .update(invoices)
    .set({ status: "Overdue", updatedAt: new Date() })
    .where(and(eq(invoices.status, "Unpaid"), lt(invoices.dueDate, today)))
    .returning({ id: invoices.id });
  return overdue.length;
}

/** Recomputes every Active customer's billing_status from their nextDueDate. */
export async function recalculateAllBillingStatuses(): Promise<void> {
  const today = todayStr();
  const allCustomers = await db.select().from(customers);
  for (const customer of allCustomers) {
    const status = computeBillingStatus(customer.nextDueDate, today);
    if (status !== customer.billingStatus) {
      await db
        .update(customers)
        .set({ billingStatus: status, updatedAt: new Date() })
        .where(eq(customers.id, customer.id));
    }
  }
}

/**
 * The full recurring billing tick: mark overdue invoices, refresh every
 * customer's billing status, then top up missing invoices for anyone whose
 * cycle has arrived. Idempotent - safe to run on a timer or on demand.
 */
export async function runBillingCycle(): Promise<{
  overdueMarked: number;
  invoicesGenerated: number;
}> {
  const overdueMarked = await markOverdueInvoices();
  await recalculateAllBillingStatuses();
  const invoicesGenerated = await generateMonthlyInvoicesForActiveCustomers();
  // Overdue invoices can flip a customer's status; recompute once more so
  // the dashboard/customer table reflect it within the same tick.
  await recalculateAllBillingStatuses();
  return { overdueMarked, invoicesGenerated };
}

export interface RecordPaymentInput {
  paymentMethod: "Cash" | "Bank Transfer" | "Credit Card" | "Mobile Wallet" | "Other";
  paymentDate?: string;
  amount?: number;
  referenceNumber?: string;
  notes?: string;
}

/**
 * The full payment flow described in the spec:
 *  1. Load the invoice, guard against double-payment/cancelled invoices.
 *  2. Mark it Paid and stamp payment details.
 *  3. Insert a permanent payment record (never deleted).
 *  4. Advance the customer's next due date.
 *  5. Generate next month's invoice for the new cycle.
 */
export async function recordInvoicePayment(
  invoiceId: string,
  input: RecordPaymentInput
): Promise<{ invoice: Invoice; nextInvoice: Invoice | null; customer: Customer }> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) {
    throw Object.assign(new Error("Invoice not found"), { status: 404 });
  }
  if (invoice.status === "Paid") {
    throw Object.assign(new Error("Invoice is already paid"), { status: 409 });
  }
  if (invoice.status === "Cancelled") {
    throw Object.assign(new Error("Cannot pay a cancelled invoice"), { status: 409 });
  }

  const paymentDate = input.paymentDate || todayStr();
  const amount = input.amount ?? Number(invoice.amount);

  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status: "Paid",
      paymentDate,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? invoice.notes,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  await db.insert(payments).values({
    id: ids.payment(),
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    paymentDate,
    amount: String(amount),
    paymentMethod: input.paymentMethod,
    referenceNumber: input.referenceNumber,
    notes: input.notes ?? "",
  });

  const [customer] = await db.select().from(customers).where(eq(customers.id, invoice.customerId));
  let updatedCustomer = customer;
  let nextInvoice: Invoice | null = null;

  if (customer) {
    const candidateNextDue = computeNextDueDate(invoice.dueDate, customer.dueDay);
    // Only move the schedule forward - never backward - in case invoices
    // were paid out of chronological order.
    const shouldAdvance = candidateNextDue > customer.nextDueDate;
    const newNextDueDate = shouldAdvance ? candidateNextDue : customer.nextDueDate;
    const newBillingStatus = computeBillingStatus(newNextDueDate);

    const [refreshedCustomer] = await db
      .update(customers)
      .set({
        nextDueDate: newNextDueDate,
        billingStatus: newBillingStatus,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id))
      .returning();
    updatedCustomer = refreshedCustomer;

    if (customer.status === "Active") {
      nextInvoice = await createInvoiceForCycle(updatedCustomer, newNextDueDate, false);
    }
  }

  return { invoice: updatedInvoice, nextInvoice, customer: updatedCustomer };
}
