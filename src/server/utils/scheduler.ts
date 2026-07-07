/**
 * Minimal in-process scheduler for the recurring billing cycle. This
 * codebase has no external cron/queue infrastructure, so "automatic every
 * month" is implemented as an idempotent job (see
 * services/billing.service.ts#runBillingCycle) that:
 *   - marks overdue invoices
 *   - recomputes every customer's billing status
 *   - generates any invoices whose due-date cycle has arrived
 *
 * Running it once a day is more than enough cadence for monthly billing
 * cycles, and running it again on server restart means a cycle is never
 * missed just because the process happened to be down on the due date.
 */
import { runBillingCycle } from "../services/billing.service.ts";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let started = false;

export function startBillingScheduler() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const { overdueMarked, invoicesGenerated } = await runBillingCycle();
      if (overdueMarked || invoicesGenerated) {
        console.log(
          `[billing] cycle complete - ${overdueMarked} invoice(s) marked overdue, ${invoicesGenerated} invoice(s) generated.`
        );
      }
    } catch (err) {
      console.error("[billing] scheduled billing cycle failed:", err);
    }
  };

  // Run once immediately on boot, then daily.
  tick();
  setInterval(tick, ONE_DAY_MS);
}
