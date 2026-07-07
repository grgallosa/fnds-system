import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { payments, customers } from "../../db/schema.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

const router = Router();

// Payment history is permanent and admin-visible only, same as invoices.
// Payments are never created/edited/deleted directly through this router -
// they're only ever written as a side effect of POST /invoices/:id/pay
// (see billing.service.ts#recordInvoicePayment), which keeps the audit
// trail consistent with the invoice + customer schedule it produced.
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const baseQuery = db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        customerId: payments.customerId,
        customerName: customers.fullName,
        paymentDate: payments.paymentDate,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        referenceNumber: payments.referenceNumber,
        notes: payments.notes,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(customers, eq(payments.customerId, customers.id));

    const rows = customerId
      ? await baseQuery.where(eq(payments.customerId, customerId)).orderBy(desc(payments.paymentDate))
      : await baseQuery.orderBy(desc(payments.paymentDate));

    res.json(rows);
  })
);

export default router;
