/**
 * Seeds the database with a default admin account, a sample technician
 * (with login), a couple of plans, a customer, and one repair task - enough
 * to log in and see the app working end to end on a fresh database.
 *
 * Run with: npm run db:seed
 * Safe to re-run: it checks for existing rows before inserting.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users, technicians, plans, customers, repairTasks } from "../db/schema.ts";
import { hashPassword } from "./auth/passwords.ts";
import { ids } from "./utils/ids.ts";
import { deriveDueDay, computeBillingStatus } from "./utils/billing.ts";
import { generateFirstInvoiceForCustomer } from "./services/billing.service.ts";

async function seed() {
  console.log("Seeding database...");

  // --- Admin account -------------------------------------------------
  const [existingAdmin] = await db.select().from(users).where(eq(users.username, "admin"));
  if (!existingAdmin) {
    const passwordHash = await hashPassword("ChangeMe123!");
    await db.insert(users).values({
      id: ids.user(),
      username: "admin",
      email: "admin@optifiber.local",
      passwordHash,
      role: "ADMIN",
    });
    console.log('Created admin login -> username: "admin", password: "ChangeMe123!" (change this immediately)');
  } else {
    console.log("Admin account already exists, skipping.");
  }

  // --- Sample plans ----------------------------------------------------
  const planRows = await db.select().from(plans);
  let planId = planRows[0]?.id;
  if (planRows.length === 0) {
    const [created] = await db
      .insert(plans)
      .values([
        {
          id: ids.plan(),
          name: "OptiFiber Basic",
          speed: "50 Mbps",
          monthlyPrice: "1299.00",
          description: "High-speed optical fiber basic broadband connection.",
          status: "Active",
        },
        {
          id: ids.plan(),
          name: "OptiFiber Standard",
          speed: "100 Mbps",
          monthlyPrice: "1699.00",
          description: "Ideal broadband speed for families and standard streaming.",
          status: "Active",
        },
      ])
      .returning();
    planId = created.id;
    console.log("Seeded starter plans.");
  }

  // --- Sample technician + login ---------------------------------------
  const techRows = await db.select().from(technicians);
  let techId = techRows[0]?.id;
  if (techRows.length === 0) {
    const techPasswordHash = await hashPassword("TechPass123!");
    const [techUser] = await db
      .insert(users)
      .values({
        id: ids.user(),
        username: "tech1",
        email: "marcus.vance@optifiber.local",
        passwordHash: techPasswordHash,
        role: "TECHNICIAN",
      })
      .returning();

    const [tech] = await db
      .insert(technicians)
      .values({
        id: ids.technician(),
        userId: techUser.id,
        name: "Marcus Vance",
        phone: "555-0101",
        email: "marcus.vance@optifiber.local",
        position: "Senior Field Specialist",
        status: "Active",
        profilePicture: "MV",
        joinedDate: new Date().toISOString().slice(0, 10),
      })
      .returning();
    techId = tech.id;
    console.log('Created technician login -> username: "tech1", password: "TechPass123!" (change this immediately)');
  } else {
    console.log("Technician account already exists, skipping.");
  }

  // --- Sample customer + task, so the app isn't empty on first load ----
  const customerRows = await db.select().from(customers);
  if (customerRows.length === 0 && planId) {
    const installationDate = new Date().toISOString().slice(0, 10);
    const billingStartDate = installationDate;
    const dueDay = deriveDueDay(billingStartDate);
    const nextDueDate = billingStartDate;

    const [customer] = await db
      .insert(customers)
      .values({
        id: ids.customer(),
        fullName: "John Doe",
        address: "123 Main St, Springfield",
        contactNumber: "555-0192",
        email: "john.doe@example.com",
        installationDate,
        currentPlanId: planId,
        monthlyFee: "1699.00",
        status: "Active",
        billingStartDate,
        dueDay,
        nextDueDate,
        billingStatus: computeBillingStatus(nextDueDate),
      })
      .returning();

    await generateFirstInvoiceForCustomer(customer);

    if (techId) {
      await db.insert(repairTasks).values({
        id: ids.task(),
        customerId: customer.id,
        assignedTechnicianId: techId,
        priority: "High",
        description: "Customer reports complete optical signal loss.",
        address: customer.address,
        dateCreated: new Date().toISOString().slice(0, 10),
        scheduledDate: new Date().toISOString().slice(0, 10),
        estimatedDuration: "2 hours",
        status: "Assigned",
      });
    }
    console.log("Seeded a sample customer, first invoice, and repair task.");
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
