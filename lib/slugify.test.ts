import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Lakeview Apt 2B")).toBe("lakeview-apt-2b");
  });

  it("collapses runs of non-alphanumeric characters", () => {
    expect(slugify("Corum -- Downtown!!")).toBe("corum-downtown");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Izmir--  ")).toBe("izmir");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });
});
