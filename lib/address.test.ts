import { describe, expect, it } from "vitest";
import { hasMailingAddress, formatMailingAddress } from "./address";

describe("hasMailingAddress", () => {
  it("is false for null/undefined host", () => {
    expect(hasMailingAddress(null)).toBe(false);
    expect(hasMailingAddress(undefined)).toBe(false);
  });

  it("is false when address_line is empty or whitespace", () => {
    expect(
      hasMailingAddress({ address_line: "  ", city: null, state: null, zip_code: null, country: null })
    ).toBe(false);
  });

  it("is true when address_line has content", () => {
    expect(
      hasMailingAddress({ address_line: "123 Main St", city: null, state: null, zip_code: null, country: null })
    ).toBe(true);
  });
});

describe("formatMailingAddress", () => {
  it("returns a placeholder when there's no address", () => {
    expect(formatMailingAddress(null)).toBe("(not provided yet)");
  });

  it("formats a full address across lines", () => {
    const result = formatMailingAddress({
      address_line: "123 Main St",
      city: "Austin",
      state: "TX",
      zip_code: "78701",
      country: "USA",
    });
    expect(result).toBe("123 Main St\n  Austin, TX 78701\n  USA");
  });

  it("omits missing city/state/zip pieces cleanly", () => {
    const result = formatMailingAddress({
      address_line: "123 Main St",
      city: null,
      state: null,
      zip_code: null,
      country: "USA",
    });
    expect(result).toBe("123 Main St\n  USA");
  });
});
