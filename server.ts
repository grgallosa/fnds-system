import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

import authRoutes from "./src/server/routes/auth.routes.ts";
import customersRoutes from "./src/server/routes/customers.routes.ts";
import plansRoutes from "./src/server/routes/plans.routes.ts";
import invoicesRoutes from "./src/server/routes/invoices.routes.ts";
import paymentsRoutes from "./src/server/routes/payments.routes.ts";
import expensesRoutes from "./src/server/routes/expenses.routes.ts";
import techniciansRoutes from "./src/server/routes/technicians.routes.ts";
import tasksRoutes from "./src/server/routes/tasks.routes.ts";
import logsRoutes from "./src/server/routes/logs.routes.ts";
import notificationsRoutes from "./src/server/routes/notifications.routes.ts";
import reportsRoutes from "./src/server/routes/reports.routes.ts";
import timelineRoutes from "./src/server/routes/timeline.routes.ts";
import { errorHandler } from "./src/server/middleware/errorHandler.ts";
import { startBillingScheduler } from "./src/server/utils/scheduler.ts";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // --- API routes ---------------------------------------------------
  // Every resource is its own table with its own endpoints now - no more
  // single "/api/state" blob. Auth/role checks happen inside each router,
  // enforced server-side (see src/server/middleware/auth.ts).
  app.use("/api/auth", authRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/plans", plansRoutes);
  app.use("/api/invoices", invoicesRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/expenses", expensesRoutes);
  app.use("/api/technicians", techniciansRoutes);
  app.use("/api/tasks", tasksRoutes);
  app.use("/api/logs", logsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/timeline", timelineRoutes);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Central error handler - must be registered after all routes.
  app.use(errorHandler);

  // --- Frontend serving ------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // Don't swallow unmatched /api routes into the SPA fallback.
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Recurring monthly billing: marks overdue invoices, refreshes customer
  // billing statuses, and generates invoices for any cycle that has
  // arrived. Runs once immediately, then once a day (see scheduler.ts).
  startBillingScheduler();
}

startServer();
