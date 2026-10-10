import { describe, expect, it } from "vitest";
import {
  formatCompactTokens,
  formatExactTokens,
} from "../../src/shared/utils/usageTokenFormat.js";

describe("usage token formatting", () => {
  it("keeps small counts exact", () => {
    expect(formatCompactTokens(0)).toBe("0");
    expect(formatCompactTokens(999)).toBe("999");
  });

  it("formats thousands, millions, and billions without trailing zeroes", () => {
    expect(formatCompactTokens(1_000)).toBe("1K");
    expect(formatCompactTokens(12_500)).toBe("12.5K");
    expect(formatCompactTokens(1_250_000)).toBe("1.25M");
    expect(formatCompactTokens(2_000_000_000)).toBe("2B");
  });

  it("keeps the exact localized value for tooltips", () => {
    expect(formatExactTokens(1_250_001)).toBe("1,250,001");
  });
});
