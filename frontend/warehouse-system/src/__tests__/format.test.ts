import { describe, it, expect } from "vitest";
import { formatINR, formatDaysAgo, normalizeIndianPhone } from "../lib/format";

describe("Frontend Format Utilities", () => {
  it("formats Indian Rupee currency with commas and symbol", () => {
    const formatted = formatINR(150000);
    // en-IN currency formatting includes ₹ and proper thousands separator
    expect(formatted).toMatch(/₹\s?1,50,000/);

    const zeroFormatted = formatINR(0);
    expect(zeroFormatted).toMatch(/₹\s?0/);
  });

  it("handles string amounts or undefined gracefully in formatINR", () => {
    expect(formatINR("2500")).toMatch(/₹\s?2,500/);
    expect(formatINR(undefined)).toMatch(/₹\s?0/);
    expect(formatINR(null)).toMatch(/₹\s?0/);
  });

  it("formats relative days ago descriptions accurately", () => {
    expect(formatDaysAgo(null)).toBe("Not reminded yet");
    expect(formatDaysAgo(undefined)).toBe("Not reminded yet");
    expect(formatDaysAgo("invalid-date")).toBe("Not reminded yet");

    const now = new Date();
    expect(formatDaysAgo(now)).toBe("Just now");

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatDaysAgo(twoDaysAgo)).toBe("2 days ago");
  });

  it("normalizes and validates 10-digit Indian phone numbers", () => {
    const res1 = normalizeIndianPhone("9876543210");
    expect(res1.valid).toBe(true);
    expect(res1.phone).toBe("919876543210");

    const res2 = normalizeIndianPhone("+91 98765 43210");
    expect(res2.valid).toBe(true);
    expect(res2.phone).toBe("919876543210");

    const resInvalid = normalizeIndianPhone("12345");
    expect(resInvalid.valid).toBe(false);
  });
});
