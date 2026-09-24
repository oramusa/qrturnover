import { describe, expect, it } from "vitest";
import { hasProductAccess } from "./entitlement";

const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("hasProductAccess", () => {
  it("allows an active subscription", () => {
    expect(
      hasProductAccess(
        { subscription_status: "active", trial_ends_at: "2020-01-01T00:00:00.000Z" },
        NOW
      )
    ).toBe(true);
  });

  it("allows a trial that has not expired", () => {
    expect(
      hasProductAccess(
        { subscription_status: "trialing", trial_ends_at: "2026-09-25T12:00:00.000Z" },
        NOW
      )
    ).toBe(true);
  });

  it("blocks a trial at its exact expiration time", () => {
    expect(
      hasProductAccess(
        { subscription_status: "trialing", trial_ends_at: NOW.toISOString() },
        NOW
      )
    ).toBe(false);
  });

  it("blocks an expired trial", () => {
    expect(
      hasProductAccess(
        { subscription_status: "trialing", trial_ends_at: "2026-09-23T12:00:00.000Z" },
        NOW
      )
    ).toBe(false);
  });

  it.each(["past_due", "canceled", "unpaid", "incomplete", null])(
    "blocks the %s subscription state",
    (subscriptionStatus) => {
      expect(
        hasProductAccess(
          { subscription_status: subscriptionStatus, trial_ends_at: null },
          NOW
        )
      ).toBe(false);
    }
  );

  it("blocks missing or malformed host data", () => {
    expect(hasProductAccess(null, NOW)).toBe(false);
    expect(
      hasProductAccess(
        { subscription_status: "trialing", trial_ends_at: "not-a-date" },
        NOW
      )
    ).toBe(false);
  });
});
