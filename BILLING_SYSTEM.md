# Monthly Billing & Due Date System

This adds recurring monthly billing, due dates, invoices, and payments on
top of the existing customer/plan schema.

## What's new

**Database** (`src/db/schema.ts`)
- `customers` gains: `billing_start_date`, `due_day`, `next_due_date`, `billing_status` (Current / Due Soon / Overdue).
- `invoices` gains: `invoice_number`, `billing_period_start`, `billing_period_end`, `payment_date`, `notes`. Status enum is now `Unpaid | Paid | Overdue | Cancelled` (renamed from `Pending`).
- New `payments` table: permanent, one row per payment received, linked to an invoice and customer. Never deleted or edited by the app.

**Business logic** (`src/server/utils/billing.ts`, `src/server/services/billing.service.ts`)
- Pure date math for due-day rollover (e.g. billed on the 31st correctly rolls to Feb 28/29), next-due-date calculation, and billing-status rollup.
- `runBillingCycle()`: marks overdue invoices, recomputes every customer's billing status, and generates any invoice whose cycle has arrived. Idempotent - safe to re-run.
- `recordInvoicePayment()`: the full payment flow — marks the invoice Paid, writes a payment record, advances the customer's due date, and generates next month's invoice.

**Automatic scheduling** (`src/server/utils/scheduler.ts`)
This app has no external cron/queue infrastructure, so the billing cycle runs once on server boot and then once every 24 hours via `setInterval`. It's fully idempotent, so this is safe even across restarts. An admin can also trigger it on demand from the Billing tab ("Run Monthly Billing") or via `POST /api/invoices/generate-monthly`.

**API additions**
- `POST /api/invoices/:id/pay` — the only supported way to mark an invoice Paid; runs the full payment flow above.
- `POST /api/invoices/generate-monthly` — manual trigger for the scheduler's generation step.
- `GET /api/payments` — payment history (optionally `?customerId=`).
- `GET /api/reports/billing-summary` — dashboard metrics: due today, due this week, overdue customers, outstanding balance, expected monthly revenue, collected this month.

**Frontend**
- Customer table: Next Due Date, Billing Status badge (🟢/🟡/🔴), Outstanding Balance, Last Payment columns.
- Add/Edit customer forms: Billing Start Date + Due Day override fields.
- Billing tab: invoice numbers, billing period range, "Run Monthly Billing" button, and a payment modal that captures payment date, reference number, and notes.
- Dashboard: new "Recurring Billing" metrics row (due today/this week, overdue customers, outstanding balance, expected vs. collected monthly revenue).

## Migrating an existing database

This project's only schema tool is `drizzle-kit push` (no versioned migration
files), which can't safely add the new `NOT NULL` columns to tables that
already have rows. If your database already has customers/invoices in it,
run this **once, before** `npm run db:push`:

```bash
npm run db:backfill-billing
```

It backfills `billing_start_date`/`due_day`/`next_due_date`/`billing_status`
from each customer's installation date, assigns sequential invoice numbers
and billing periods to existing invoices, creates the `payments` table, and
only then locks in the `NOT NULL`/unique constraints. It's idempotent and
safe to re-run.

On a brand-new, empty database, just run `npm run db:push` directly.

After migrating, run `npm run db:push` to sync any remaining schema
differences, and optionally `POST /api/invoices/generate-monthly` (or wait
for the daily scheduler tick) to generate any invoices for the current
cycle.
