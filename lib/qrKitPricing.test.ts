import { describe, expect, it } from "vitest";
import { calculateQrKitPrice } from "./qrKitPricing";

describe("calculateQrKitPrice", () => {
  it.each([
    [1, 3900],
    [2, 5400],
    [5, 9900],
    [10, 17400],
  ])("prices %i properties at %i cents", (propertyCount, expected) => {
    expect(calculateQrKitPrice(propertyCount)).toBe(expected);
  });

  it.each([0, 11, 1.5])("rejects an invalid property count of %s", (propertyCount) => {
    expect(() => calculateQrKitPrice(propertyCount)).toThrow(RangeError);
  });
});
