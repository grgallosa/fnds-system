# Phase 2: Real frontend, real login, real Admin/Technician split

Builds on Phase 1 (see `PHASE1_BACKEND.md`). This phase rewires the actual
UI to the real API instead of the old `/api/state` blob + fake role toggle.

## What changed

- **Real login** (`src/pages/LoginPage.tsx`, `src/context/AuthContext.tsx`).
  Signs in against `POST /api/auth/login`, stores the JWT, restores the
  session on refresh via `GET /api/auth/me`. No more "Admin / Technician"
  buttons in the header that anyone could click.
- **Genuine Admin/Technician separation** (`src/shells/AdminShell.tsx`,
  `src/shells/TechnicianShell.tsx`, loaded via `React.lazy` in `src/App.tsx`).
  `TechnicianShell` only ever imports `TasksTab` - it has no reference to
  `CustomersTab`, `BillingTab`, `ExpensesTab`, `TechniciansTab`, `ReportsTab`,
  or `LogsTab` at all, so that code isn't even downloaded in a technician
  session. Combined with the server-side role checks from Phase 1, this
  replaces the old single bundle + `state.role === "ADMIN"` conditionals.
- **Real data layer** (`src/hooks/useAppData.ts`) replaces the old
  `AppState` blob + `saveState()`. It fetches each resource from its real
  endpoint and exposes CRUD functions (`addCustomer`, `updateTask`,
  `deleteTask`, etc.) that call the API and update local state from the
  server's response - no more local mutation + hope-it-syncs.
- **Repair Task module completed**: the old `TasksTab` only had
  create/status-update/complete. Added:
  - **Edit** (`onEditTask`) and **Delete** (`onDeleteTask`) for admins,
    with a proper edit modal (reassign technician, change priority,
    schedule, duration, description).
  - **Add Note / Repair Remark** (`onAddTaskNote`) for technicians, logged
    to the customer's timeline, separate from the final completion report.
- **Activity Logs & Audit Records are real again.** Every meaningful write
  (create/update customer, plan, technician, invoice, expense, task;
  status changes; completions) now calls `recordActivity`/`recordAudit`
  (`src/server/utils/activity.ts`) so the Logs page reflects real actions
  by real logged-in users, not a client-side blob mutation.
- **Technician login provisioning**: `TechniciansTab`'s "Add Technician"
  form now has an optional username/password section so an admin can
  actually give a new technician a way to log in, instead of creating a
  technician record with no linked account (which was the case before -
  there was no UI to ever set technician credentials).

## Known follow-ups (not yet done)

- `GET /api/reports/summary` (server-computed aggregates) exists but
  `DashboardTab`/`ReportsTab` still compute their numbers client-side from
  the fetched arrays. I looked at moving this server-side and decided
  against it for now: the dashboard needs per-month and per-category
  breakdowns (customer growth by month, expenses by category), which would
  need several new bespoke aggregate endpoints, not just the one summary
  endpoint already built - a large, hard-to-test rewrite of two big files
  for a benefit (query efficiency at scale) that doesn't matter yet for a
  small-to-mid ISP's dataset. The numbers themselves are now fully correct
  since they're computed from real fetched data instead of a blob. Worth
  revisiting once the customer base is large enough for this to matter.
- I could not run `npm install` or `npm run dev` in this sandbox (no
  network access here), so **please run it locally and report back any
  TypeScript/runtime errors** - I've reviewed every file by hand but
  haven't been able to execute a real build against a real database.

## Follow-up round: done

- **Technician login credentials can now be set/reset after creation.**
  `PUT /api/technicians/:id/credentials` creates a login if the technician
  doesn't have one yet, or resets username/password if they do. Wired into
  a "Portal Login" section in the Edit Technician modal.
- **Fixed hardcoded dates that would have gone stale.** The old app (and
  my Phase 1/2 pass initially) had several UI defaults hardcoded to a
  fixed date - e.g. "today" was literally the string `"2026-07-05"`, this
  month was hardcoded to `"2026-06"`, new invoices defaulted to
  `"July 2026"` due `"2026-07-15"`, and the customer-growth chart used a
  fixed 6-month list (`2025-03` ... `2026-05`). All of these now compute
  from the real current date (`DashboardTab`, `BillingTab`, `TasksTab`),
  so the dashboard and billing defaults won't silently go wrong once real
  time moves past mid-2026.

## How to run it

Same steps as Phase 1's `PHASE1_BACKEND.md`, then just `npm run dev` and
log in with the seeded `admin` / `tech1` credentials it prints.
