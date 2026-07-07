import { describe, it, expect } from "vitest";
import {
  addMonthsClamped,
  computeNextDueDate,
  computeBillingStatus,
  computeBillingPeriod,
  DUE_SOON_WINDOW_DAYS,
} from "./billing.ts";

describe("addMonthsClamped", () => {
  it("clamps 31st -> Feb in a non-leap year", () => {
    expect(addMonthsClamped("2025-01-31", 1, 31)).toBe("2025-02-28");
  });

  it("clamps 31st -> Feb in a leap year", () => {
    expect(addMonthsClamped("2024-01-31", 1, 31)).toBe("2024-02-29");
  });

  it("clamps 30th -> Feb", () => {
    expect(addMonthsClamped("2025-01-30", 1, 30)).toBe("2025-02-28");
  });

  it("clamps a 29th (leap day) due day rolling into a non-leap Feb", () => {
    // Starting from Feb 29 2024 (leap year), due day 29, 12 months later
    // lands on Feb 2025 - a non-leap year, so it clamps to the 28th.
    expect(addMonthsClamped("2024-02-29", 12, 29)).toBe("2025-02-28");
  });
});

describe("computeNextDueDate", () => {
  it("does not drift once clamped - billed on the 31st returns to the 31st once a 31-day month comes around again", () => {
    // Jan 31 -> Feb (clamped to 28, since dueDay is fixed at 31 regardless
    // of the previous, already-clamped result) -> Mar (back to 31, not
    // stuck at 28).
    const dueDay = 31;
    const jan = "2025-01-31";
    const feb = computeNextDueDate(jan, dueDay);
    const mar = computeNextDueDate(feb, dueDay);

    expect(feb).toBe("2025-02-28");
    expect(mar).toBe("2025-03-31");
  });
});

describe("computeBillingStatus", () => {
  const today = "2026-06-15";

  it("is Due Soon when the due date is today (diff = 0)", () => {
    expect(computeBillingStatus(today, today)).toBe("Due Soon");
  });

  it("is Due Soon exactly at the DUE_SOON_WINDOW_DAYS boundary", () => {
    const boundaryDate = "2026-06-22"; // today + 7 days
    expect(computeBillingStatus(boundaryDate, today)).toBe("Due Soon");
  });

  it("is Current one day past the Due Soon window", () => {
    const justPastWindow = "2026-06-23"; // today + 8 days
    expect(computeBillingStatus(justPastWindow, today)).toBe("Current");
  });

  it("is Overdue when the due date is in the past", () => {
    const pastDate = "2026-06-14"; // today - 1 day
    expect(computeBillingStatus(pastDate, today)).toBe("Overdue");
  });

  it("uses the DUE_SOON_WINDOW_DAYS constant, not a re-typed magic number", () => {
    // Sanity check that the module's exported constant is what the
    // boundary tests above assume - if this constant ever changes, the
    // boundary tests above should be revisited too.
    expect(DUE_SOON_WINDOW_DAYS).toBe(7);
  });
});

describe("computeBillingPeriod", () => {
  it("uses the billing start date as the period start for a first invoice", () => {
    const result = computeBillingPeriod("2026-07-15", 15, true, "2026-07-15");
    expect(result).toEqual({
      billingPeriodStart: "2026-07-15",
      billingPeriodEnd: "2026-07-15",
    });
  });

  it("uses the previous month's (clamped) due day as the period start for a normal subsequent cycle", () => {
    const result = computeBillingPeriod("2026-08-15", 15, false, "2026-01-15");
    expect(result).toEqual({
      billingPeriodStart: "2026-07-15",
      billingPeriodEnd: "2026-08-15",
    });
  });

  it("clamps the previous month's period start for a short month", () => {
    // Due date March 31 -> previous month is Feb, clamped to Feb 28 (2026
    // is not a leap year).
    const result = computeBillingPeriod("2026-03-31", 31, false, "2025-01-31");
    expect(result).toEqual({
      billingPeriodStart: "2026-02-28",
      billingPeriodEnd: "2026-03-31",
    });
  });
});
