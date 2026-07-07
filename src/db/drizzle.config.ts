import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SQL_CONNECTION_STRING;
const sslEnabled = process.env.SQL_SSL !== "false";

let dbCredentials;

if (connectionString) {
  dbCredentials = { url: connectionString, ssl: sslEnabled ? "require" as const : false };
} else {
  const sqlHost = process.env.SQL_HOST;
  const sqlDbName = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_ADMIN_PASSWORD;

  if (!sqlHost) {
    throw new Error("SQL_HOST must be set in environment variables (or set DATABASE_URL instead).");
  }
  if (!sqlDbName) {
    throw new Error("SQL_DB_NAME must be set in environment variables.");
  }
  if (!user) {
    throw new Error("SQL_ADMIN_USER must be set in environment variables.");
  }
  if (!password) {
    throw new Error("SQL_ADMIN_PASSWORD must be set in environment variables.");
  }

  dbCredentials = {
    host: sqlHost,
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: sslEnabled ? ("require" as const) : false,
  };
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials,
  verbose: true,
});
