/**
 * One-time migration helper for EXISTING, already-populated databases.
 *
 * This project's only schema-migration mechanism is `drizzle-kit push`
 * (there are no versioned migration files), which works great for
 * greenfield/empty databases but cannot safely add the new NOT NULL
 * billing columns (billing_start_date, due_day, next_due_date,
 * billing_status on customers; invoice_number, billing_period_start/end on
 * invoices) directly to tables that already have rows - there'd be nothing
 * to fill those columns with.
 *
 * Run this ONCE, BEFORE `npm run db:push`, on any database that already has
 * customers/invoices in it:
 *
 *   tsx src/server/backfill-billing.ts
 *
 * It is idempotent and safe to re-run: every step uses
 * `ADD COLUMN IF NOT EXISTS` / only fills rows where the value is still
 * null, so running it twice (or running it, then running db:push, then
 * running it again) does not corrupt data.
 *
 * On a brand new, empty database you can skip this and just run
 * `npm run db:push` directly - drizzle will create the NOT NULL columns
 * with no rows to worry about.
 */
import "dotenv/config";
import { createPool } from "../db/index.ts";
import { deriveDueDay, computeBillingStatus } from "./utils/billing.ts";

async function backfill() {
  const pool = createPool();
  const client = await pool.connect();

  try {
    console.log("Starting billing backfill...");

    // --- customers: add columns as nullable first -----------------------
    await client.query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS billing_start_date text,
        ADD COLUMN IF NOT EXISTS due_day integer,
        ADD COLUMN IF NOT EXISTS next_due_date text
    `);
    // billing_status enum + column (create enum type if missing)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE billing_status AS ENUM ('Current', 'Due Soon', 'Overdue');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS billing_status billing_status
    `);

    // --- invoices: add new columns as nullable ---------------------------
    await client.query(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS invoice_number text,
        ADD COLUMN IF NOT EXISTS billing_period_start text,
        ADD COLUMN IF NOT EXISTS billing_period_end text,
        ADD COLUMN IF NOT EXISTS payment_date text,
        ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT ''
    `);
    // The old status enum used "Pending" - rename its label to "Unpaid" in
    // place so existing rows keep their meaning under the new name.
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE invoice_status RENAME VALUE 'Pending' TO 'Unpaid';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    // Migrate the old single billing_period text column into
    // billing_period_start/end if it still exists.
    const oldColumnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoices' AND column_name = 'billing_period'
    `);
    if (oldColumnCheck.rows.length > 0) {
      await client.query(`
        UPDATE invoices
        SET billing_period_start = COALESCE(billing_period_start, due_date),
            billing_period_end = COALESCE(billing_period_end, due_date)
        WHERE billing_period_start IS NULL
      `);
    }
    // paid_date -> payment_date (old column name), if present.
    const oldPaidDateCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoices' AND column_name = 'paid_date'
    `);
    if (oldPaidDateCheck.rows.length > 0) {
      await client.query(`
        UPDATE invoices SET payment_date = paid_date WHERE payment_date IS NULL
      `);
    }

    // --- Fill in per-row billing schedule for customers ------------------
    const { rows: customerRows } = await client.query(
      `SELECT id, installation_date FROM customers WHERE billing_start_date IS NULL OR due_day IS NULL OR next_due_date IS NULL OR billing_status IS NULL`
    );
    console.log(`Backfilling billing schedule for ${customerRows.length} customer(s)...`);
    for (const row of customerRows) {
      const billingStartDate = row.installation_date;
      const dueDay = deriveDueDay(billingStartDate);
      const nextDueDate = billingStartDate;
      const billingStatus = computeBillingStatus(nextDueDate);
      await client.query(
        `UPDATE customers
         SET billing_start_date = COALESCE(billing_start_date, $1),
             due_day = COALESCE(due_day, $2),
             next_due_date = COALESCE(next_due_date, $3),
             billing_status = COALESCE(billing_status, $4)
         WHERE id = $5`,
        [billingStartDate, dueDay, nextDueDate, billingStatus, row.id]
      );
    }

    // --- Fill in invoice_number + billing period for existing invoices ---
    const { rows: invoiceRows } = await client.query(
      `SELECT id, due_date FROM invoices WHERE invoice_number IS NULL ORDER BY created_at ASC`
    );
    console.log(`Backfilling invoice numbers for ${invoiceRows.length} invoice(s)...`);
    const yearSeq = new Map<number, number>();
    for (const row of invoiceRows) {
      const year = new Date(row.due_date).getUTCFullYear();
      const seq = (yearSeq.get(year) ?? 0) + 1;
      yearSeq.set(year, seq);
      const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;
      await client.query(
        `UPDATE invoices
         SET invoice_number = $1,
             billing_period_start = COALESCE(billing_period_start, due_date),
             billing_period_end = COALESCE(billing_period_end, due_date)
         WHERE id = $2`,
        [invoiceNumber, row.id]
      );
    }

    // --- Now that every row has a value, lock in the NOT NULL + unique
    // constraints that the schema expects. ---------------------------------
    await client.query(`ALTER TABLE customers ALTER COLUMN billing_start_date SET NOT NULL`);
    await client.query(`ALTER TABLE customers ALTER COLUMN due_day SET NOT NULL`);
    await client.query(`ALTER TABLE customers ALTER COLUMN next_due_date SET NOT NULL`);
    await client.query(`ALTER TABLE customers ALTER COLUMN billing_status SET NOT NULL`);
    await client.query(`ALTER TABLE customers ALTER COLUMN billing_status SET DEFAULT 'Current'`);

    await client.query(`ALTER TABLE invoices ALTER COLUMN invoice_number SET NOT NULL`);
    await client.query(`ALTER TABLE invoices ALTER COLUMN billing_period_start SET NOT NULL`);
    await client.query(`ALTER TABLE invoices ALTER COLUMN billing_period_end SET NOT NULL`);
    await client.query(`
      DO $$ BEGIN
        CREATE UNIQUE INDEX invoices_invoice_number_unique ON invoices (invoice_number);
      EXCEPTION WHEN duplicate_table THEN NULL; END $$;
    `);
    await client.query(`ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'Unpaid'`);

    // --- Payments table (new) --------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id text PRIMARY KEY,
        invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        customer_id text NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        payment_date text NOT NULL,
        amount numeric(10, 2) NOT NULL,
        payment_method payment_method NOT NULL,
        reference_number text,
        notes text NOT NULL DEFAULT '',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // Drop the now-superseded old columns, if they still exist.
    await client.query(`ALTER TABLE invoices DROP COLUMN IF EXISTS billing_period`);
    await client.query(`ALTER TABLE invoices DROP COLUMN IF EXISTS paid_date`);

    console.log("Billing backfill complete. You can now safely run `npm run db:push`.");
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error("Billing backfill failed:", err);
  process.exit(1);
});
