/**
 * Core business logic for the recurring monthly billing system. Routes stay
 * thin (HTTP concerns only) and call into this module for anything that
 * touches billing rules, so the logic exists in exactly one place.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db, pool } from "../../db/index.ts";
import { customers, invoices, payments, Customer, Invoice } from "../../db/schema.ts";
import { ids } from "../utils/ids.ts";
import {
  computeBillingPeriod,
  computeBillingStatus,
  computeNextDueDate,
  todayStr,
  DUE_SOON_WINDOW_DAYS,
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
  // Only Unpaid/Paid/Overdue invoices count as "already exists for this
  // cycle" - a Cancelled invoice for this due date must not permanently
  // block a real invoice from ever being generated for the same cycle.
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, customer.id),
        eq(invoices.dueDate, dueDate),
        sql`${invoices.status} in ('Unpaid', 'Paid', 'Overdue')`
      )
    );
  if (existing) return null;

  const { billingPeriodStart, billingPeriodEnd } = computeBillingPeriod(
    dueDate,
    customer.dueDay,
    isFirstInvoice,
    customer.billingStartDate
  );
  const year = new Date(dueDate).getUTCFullYear();
  const invoiceNumber = await generateInvoiceNumber(year);

  try {
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
  } catch (err: any) {
    // Postgres unique-violation on invoices_customer_id_due_date_unique -
    // another concurrent call already created this cycle's invoice between
    // our SELECT check above and this INSERT (the exact TOCTOU race the
    // unique index exists to close). Treat it the same as the pre-check
    // finding an existing row: "already exists," not an error.
    if (err?.code === "23505") return null;
    throw err;
  }
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

/**
 * Recomputes every customer's billing_status from their nextDueDate, in one
 * round trip per status bucket (3 total) instead of one SELECT plus one
 * UPDATE per customer row. Must stay in lockstep with the exact thresholds
 * in computeBillingStatus (utils/billing.ts) - the "Due Soon" cutoff is
 * pulled from that module's DUE_SOON_WINDOW_DAYS constant (passed as a bound
 * parameter below) rather than re-typed as a SQL literal, so the two
 * implementations can't silently drift apart.
 *
 * Semantics, mirroring computeBillingStatus exactly:
 *   diff = nextDueDate - today (days)
 *   diff < 0                        -> Overdue
 *   0 <= diff <= DUE_SOON_WINDOW_DAYS -> Due Soon
 *   diff > DUE_SOON_WINDOW_DAYS      -> Current
 */
export async function recalculateAllBillingStatuses(): Promise<void> {
  const today = todayStr();

  await db.execute(sql`
    UPDATE customers
    SET billing_status = 'Overdue', updated_at = now()
    WHERE billing_status <> 'Overdue'
      AND (next_due_date::date - ${today}::date) < 0
  `);

  await db.execute(sql`
    UPDATE customers
    SET billing_status = 'Due Soon', updated_at = now()
    WHERE billing_status <> 'Due Soon'
      AND (next_due_date::date - ${today}::date) >= 0
      AND (next_due_date::date - ${today}::date) <= ${DUE_SOON_WINDOW_DAYS}
  `);

  await db.execute(sql`
    UPDATE customers
    SET billing_status = 'Current', updated_at = now()
    WHERE billing_status <> 'Current'
      AND (next_due_date::date - ${today}::date) > ${DUE_SOON_WINDOW_DAYS}
  `);
}

// Arbitrary fixed constant key for the "billing cycle" advisory lock. Any
// two 32-bit ints work as long as they're stable and not reused for an
// unrelated lock elsewhere in the app - pg_try_advisory_lock takes a single
// bigint, so we pack two int4 "namespace, purpose" values via the two-arg
// overload to keep this collision-safe from any other advisory lock this
// codebase might add in the future.
const BILLING_CYCLE_LOCK_NAMESPACE = 851203; // arbitrary, "FNDS" billing namespace
const BILLING_CYCLE_LOCK_KEY = 1; // "billing cycle" within that namespace

/**
 * The full recurring billing tick: mark overdue invoices, refresh every
 * customer's billing status, then top up missing invoices for anyone whose
 * cycle has arrived. Idempotent - safe to run on a timer or on demand.
 *
 * Guarded by a Postgres advisory lock so that if this app is ever run as
 * more than one instance (rolling deploy, cluster mode, horizontal scaling),
 * only one instance's tick actually executes at a time - the rest skip
 * their run rather than racing each other and duplicating work. The lock is
 * a safety net on top of the existing daily-tick-plus-run-on-boot scheduling
 * in scheduler.ts, not a replacement for it.
 */
export async function runBillingCycle(): Promise<{
  overdueMarked: number;
  invoicesGenerated: number;
  skipped?: boolean;
}> {
  // pg_try_advisory_lock must be acquired and released on the SAME
  // connection/session, so we check out one dedicated client from the pool
  // for the lifetime of the lock rather than using the shared `db` query
  // builder (which may run each query on a different pooled connection).
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      [BILLING_CYCLE_LOCK_NAMESPACE, BILLING_CYCLE_LOCK_KEY]
    );
    const acquired: boolean = rows[0]?.acquired === true;
    if (!acquired) {
      console.log("[billing] another instance is already running the billing cycle - skipping.");
      return { overdueMarked: 0, invoicesGenerated: 0, skipped: true };
    }

    try {
      const overdueMarked = await markOverdueInvoices();
      await recalculateAllBillingStatuses();
      const invoicesGenerated = await generateMonthlyInvoicesForActiveCustomers();
      // Overdue invoices can flip a customer's status; recompute once more so
      // the dashboard/customer table reflect it within the same tick.
      await recalculateAllBillingStatuses();
      return { overdueMarked, invoicesGenerated };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1, $2)", [
        BILLING_CYCLE_LOCK_NAMESPACE,
        BILLING_CYCLE_LOCK_KEY,
      ]);
    }
  } finally {
    client.release();
  }
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
