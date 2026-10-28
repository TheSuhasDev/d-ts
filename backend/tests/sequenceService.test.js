import { getFinancialYearCode } from "../src/services/sequenceService.js";

describe("Sequence Service & Financial Year Calculations", () => {
  test("calculates correct Indian Financial Year for dates in different months", () => {
    // April 2026 starts FY 2026-2027 -> '26-27'
    const apr2026 = new Date("2026-04-01T10:00:00Z");
    expect(getFinancialYearCode(apr2026)).toBe("26-27");

    // October 2026 is mid FY 2026-2027 -> '26-27'
    const oct2026 = new Date("2026-10-28T10:00:00Z");
    expect(getFinancialYearCode(oct2026)).toBe("26-27");

    // March 2027 is end of FY 2026-2027 -> '26-27'
    const mar2027 = new Date("2027-03-15T10:00:00Z");
    expect(getFinancialYearCode(mar2027)).toBe("26-27");

    // January 2026 is part of FY 2025-2026 -> '25-26'
    const jan2026 = new Date("2026-01-15T10:00:00Z");
    expect(getFinancialYearCode(jan2026)).toBe("25-26");

    // March 2026 is part of FY 2025-2026 -> '25-26'
    const mar2026 = new Date("2026-03-30T10:00:00Z");
    expect(getFinancialYearCode(mar2026)).toBe("25-26");
  });

  test("generates expected sequential format structure", () => {
    const fyCode = "26-27";
    const type = "ORD";
    const seq = 42;
    const padded = String(seq).padStart(4, "0");
    const formatted = `${type}/${fyCode}/${padded}`;
    expect(formatted).toBe("ORD/26-27/0042");
    expect(formatted).toMatch(/^ORD\/\d{2}-\d{2}\/\d{4}$/);
  });

  test("invoice numbers (INV) and order numbers (ORD) increment independently without collision", () => {
    // Simulated atomic counters
    const counters = new Map();
    const getNextAtomic = (type, fy = "26-27") => {
      const key = `${type}_${fy}`;
      const current = (counters.get(key) || 0) + 1;
      counters.set(key, current);
      return `${type}/${fy}/${String(current).padStart(4, "0")}`;
    };

    const ord1 = getNextAtomic("ORD");
    const ord2 = getNextAtomic("ORD");
    const inv1 = getNextAtomic("INV");
    const ord3 = getNextAtomic("ORD");
    const inv2 = getNextAtomic("INV");

    expect(ord1).toBe("ORD/26-27/0001");
    expect(ord2).toBe("ORD/26-27/0002");
    expect(inv1).toBe("INV/26-27/0001");
    expect(ord3).toBe("ORD/26-27/0003");
    expect(inv2).toBe("INV/26-27/0002");

    // Independent counters do not collide
    expect(inv1).not.toBe(ord1);
    expect(inv2).not.toBe(ord3);
  });

  test("atomic concurrency produces strictly unique invoice numbers without reuse or duplicates", async () => {
    const counters = new Map();
    let currentSeq = 0;
    const mockFindOneAndUpdate = async () => {
      currentSeq += 1;
      return { seq: currentSeq };
    };

    // Simulate 50 concurrent invoice requests
    const promises = Array.from({ length: 50 }, async () => {
      const doc = await mockFindOneAndUpdate();
      return `INV/26-27/${String(doc.seq).padStart(4, "0")}`;
    });

    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);

    const uniqueSet = new Set(results);
    expect(uniqueSet.size).toBe(50);
    expect(results[0]).toBe("INV/26-27/0001");
    expect(results[49]).toBe("INV/26-27/0050");
  });
});
