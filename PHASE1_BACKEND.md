# Phase 1: Real database + real API (backend rebuild)

## What changed

**Before:** one Postgres table (`app_states`) held the entire app as a single
JSON blob, overwritten wholesale on every save. No auth. "Role" was a field
in that blob flipped by a button in the UI — anyone could become Admin.

**Now:**

- Real relational schema (`src/db/schema.ts`): `users`, `plans`, `customers`,
  `technicians`, `invoices`, `expenses`, `repair_tasks`,
  `customer_timeline_events`, `activity_logs`, `audit_records`,
  `notifications` — with real foreign keys (e.g. a repair task references a
  real customer row and a real technician row).
- Real REST API, one router per resource, under `src/server/routes/`.
- Real authentication: `POST /api/auth/login` returns a signed JWT. Every
  other endpoint requires `Authorization: Bearer <token>`. Role
  (`ADMIN`/`TECHNICIAN`) is read from the verified token server-side — the
  client can no longer just declare itself Admin.
- Server-side validation on every write, using `zod` schemas
  (`src/server/validation/schemas.ts`) — bad data is rejected with a 400 and
  field-level messages before it ever reaches the database.
- Technicians are scoped server-side: `GET /api/tasks` for a technician
  token only ever returns tasks assigned to that technician, enforced in the
  route handler, not just hidden in the UI.
- Passwords are hashed with bcrypt (`src/server/auth/passwords.ts`) — never
  stored in plaintext.
- Sensible delete guards: e.g. you can't delete a plan that customers are
  still subscribed to, or a technician with open tasks, without dealing with
  those first — prevents silent orphaned data.
- Deleted the "if any plan costs under 500, wipe the DB back to seed data"
  hack that was in the old `server.ts`.

## Setup

1. **Get a Postgres database.** Any of these work: a local Postgres, Neon,
   Supabase, Railway, or Cloud SQL. You said you're not sure yet — a free
   [Neon](https://neon.tech) or [Supabase](https://supabase.com) project is
   the fastest way to get `host`/`user`/`password`/`database` values to fill
   into `.env`.

2. Copy `.env.example` to `.env` and fill in:
   ```
   SQL_HOST=...
   SQL_DB_NAME=...
   SQL_USER=...
   SQL_PASSWORD=...
   SQL_ADMIN_USER=...        # can be the same as SQL_USER
   SQL_ADMIN_PASSWORD=...    # can be the same as SQL_PASSWORD
   JWT_SECRET=...            # generate with the command in the comment above it
   ```

3. Install dependencies (adds `bcryptjs`, `jsonwebtoken`, `zod`; removes
   unused `firebase`/`firebase-admin`/`@google/genai` which nothing in the
   code actually used):
   ```
   npm install
   ```

4. Push the schema to your database:
   ```
   npm run db:push
   ```

5. Seed a default admin + technician login and a bit of starter data:
   ```
   npm run db:seed
   ```
   This prints the generated credentials, e.g.:
   ```
   admin / ChangeMe123!
   tech1 / TechPass123!
   ```
   **Change these passwords immediately** — they're only there so you can
   log in on day one.

6. Run it:
   ```
   npm run dev
   ```

## API quick reference

All endpoints are under `/api`. All except `/auth/login` require
`Authorization: Bearer <token>` from step above.

| Resource | Admin | Technician |
|---|---|---|
| `POST /auth/login` | ✅ | ✅ |
| `GET /customers`, `/customers/:id` | ✅ | ✅ (read-only) |
| `POST/PUT/DELETE /customers` | ✅ | ❌ |
| `GET/POST/PUT/DELETE /plans` | ✅ | read-only |
| `GET/POST/PUT/DELETE /invoices` | ✅ | ❌ (no billing access) |
| `GET/POST/PUT/DELETE /expenses` | ✅ | ❌ |
| `GET/POST/PUT/DELETE /technicians` | ✅ | own profile only |
| `GET/POST/PUT/DELETE /tasks` | ✅ (all tasks) | own assigned tasks only |
| `PATCH /tasks/:id/status` | ✅ | own tasks only |
| `POST /tasks/:id/complete` | ✅ | own tasks only |
| `GET /tasks/history/:customerId` | ✅ | own tasks only |
| `GET /logs/activity`, `/logs/audit` | ✅ | ❌ |
| `GET /notifications` | ✅ | ✅ (own role's feed) |
| `GET /reports/summary` | ✅ | ❌ |

## What's NOT done yet (Phase 2)

The frontend (`src/App.tsx` and everything in `src/components/`) still talks
to the **old** `/api/state` endpoint and still uses the fake client-side role
toggle. Those endpoints no longer exist, so **the existing UI will not work
against this new backend yet** — that rewiring is Phase 2:

1. A real login screen, storing the JWT and attaching it to every request.
2. Splitting the single `App.tsx` shell into an `/admin` shell and a
   `/technician` shell that import only the components each role is allowed
   to see (not just conditionally rendering inside one shared bundle).
3. Rewiring each tab (`CustomersTab`, `PlansTab`, `TasksTab`, etc.) to call
   the new per-resource endpoints instead of mutating one local `state`
   object and POSTing the whole thing back.
4. UI polish pass (spacing, empty/loading/error states) once the above is
   solid.

Say the word and I'll start on that next.
