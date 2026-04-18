import { describe, it, expect } from "vitest";
import { formatCount } from "@/lib/formatCount";

describe("formatCount", () => {
  it("returns null for 0", () => {
    expect(formatCount(0)).toBeNull();
  });

  it("returns the number as a string for small positive values", () => {
    expect(formatCount(1)).toBe("1");
    expect(formatCount(5)).toBe("5");
    expect(formatCount(42)).toBe("42");
  });

  it("returns '99' for exactly 99", () => {
    expect(formatCount(99)).toBe("99");
  });

  it("returns '99+' for 100", () => {
    expect(formatCount(100)).toBe("99+");
  });

  it("returns '99+' for values far above 99", () => {
    expect(formatCount(500)).toBe("99+");
    expect(formatCount(10_000)).toBe("99+");
  });

  it("returns null for negative values (defensive)", () => {
    expect(formatCount(-1)).toBeNull();
  });
});
