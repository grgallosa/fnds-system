import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

const { Pool } = pg;

// SSL is required by most managed Postgres providers (Supabase, Neon, etc.).
// Allow opting out for a fully local/self-hosted Postgres via SQL_SSL=false.
const sslEnabled = process.env.SQL_SSL !== "false";

export const createPool = () => {
  // Prefer a full connection string if provided (e.g. Supabase's pooler
  // connection string), otherwise fall back to discrete host/user/password
  // fields for backward compatibility with existing setups.
  const connectionString = process.env.DATABASE_URL || process.env.SQL_CONNECTION_STRING;

  if (connectionString) {
    return new Pool({
      connectionString,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 15000,
    });
  }

  return new Pool({
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });
};

export const pool = createPool();

pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

export const db = drizzle(pool, { schema });
