/**
 * One-time migration helper for EXISTING, already-populated databases,
 * following the same additive-migration pattern as
 * `src/server/backfill-billing.ts`.
 *
 * `npm run db:push` (drizzle-kit push) cannot safely add a UNIQUE index on
 * `invoices (customer_id, due_date)` if any duplicate rows for that pair
 * already exist - the push would simply fail with a constraint-violation
 * error, and would give no visibility into *which* rows are the problem.
 *
 * Run this ONCE, BEFORE `npm run db:push`, on any database that already has
 * invoices in it:
 *
 *   tsx src/server/migrations/add-invoice-cycle-unique-index.ts
 *
 * It never deletes data. It only:
 *   1. Reports any existing (customer_id, due_date) duplicates so a human
 *      can decide how to resolve them (e.g. cancel the extra invoice).
 *   2. If, and only if, no duplicates remain, creates the unique index.
 *
 * Safe to re-run: it checks pg_indexes before creating, so running it twice
 * is a no-op the second time.
 *
 * On a brand-new, empty database you can skip this and just run
 * `npm run db:push` directly - there's nothing to conflict with.
 */
import "dotenv/config";
import { createPool } from "../../db/index.ts";

async function migrate() {
  const pool = createPool();
  const client = await pool.connect();

  try {
    console.log("Checking for existing (customer_id, due_date) duplicate invoices...");

    const { rows: duplicates } = await client.query(`
      SELECT customer_id, due_date, array_agg(id ORDER BY created_at) AS invoice_ids, count(*) AS cnt
      FROM invoices
      GROUP BY customer_id, due_date
      HAVING count(*) > 1
    `);

    if (duplicates.length > 0) {
      console.log(
        `Found ${duplicates.length} customer/due-date pair(s) with duplicate invoices. ` +
          `Resolve these manually (e.g. cancel/merge the extras) before re-running this ` +
          `script - the unique index will NOT be created until they're gone:`
      );
      for (const row of duplicates) {
        console.log(
          `  customer_id=${row.customer_id} due_date=${row.due_date} invoice_ids=${row.invoice_ids.join(", ")}`
        );
      }
      console.log("No changes made. Exiting without creating the index.");
      return;
    }

    console.log("No duplicates found. Creating unique index...");
    const existingIndex = await client.query(`
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'invoices' AND indexname = 'invoices_customer_id_due_date_unique'
    `);
    if (existingIndex.rows.length > 0) {
      console.log("Index already exists - nothing to do.");
      return;
    }

    await client.query(`
      CREATE UNIQUE INDEX invoices_customer_id_due_date_unique
      ON invoices (customer_id, due_date)
    `);
    console.log(
      "Unique index invoices_customer_id_due_date_unique created. You can now safely run `npm run db:push`."
    );
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Invoice cycle unique-index migration failed:", err);
  process.exit(1);
});
