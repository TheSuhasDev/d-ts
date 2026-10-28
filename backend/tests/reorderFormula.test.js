import {
  calculateWinsorizedBurnRate,
  classifyStockStatus,
} from "../src/services/reorderService.js";

describe("Smart Reorder Logic & Stock Status Classifier", () => {
  describe("Outlier-Robust Winsorized Daily Burn Rate", () => {
    test("handles normal steady dispatches without modification", () => {
      // 30 days of 2 units each day = 60 units total
      const daily = Array(30).fill(2);
      const rate = calculateWinsorizedBurnRate(daily, 30);
      expect(rate).toBe(2);
    });

    test("winsorizes extreme 1-day spike so it does not inflate daily burn rate", () => {
      // 29 days of 1 unit, and 1 day with a massive 25 unit test data surge
      const daily = [...Array(29).fill(1), 25];
      const rawAvg = (29 * 1 + 25) / 30; // 1.80

      const robustRate = calculateWinsorizedBurnRate(daily, 30);
      // Robust rate caps the 25-unit outlier at mean + 3*stdDev, significantly reducing inflation
      expect(robustRate).toBeLessThan(rawAvg);
      expect(robustRate).toBeLessThan(1.6);
    });

    test("returns 0 for empty or all-zero dispatches", () => {
      expect(calculateWinsorizedBurnRate([], 30)).toBe(0);
      expect(calculateWinsorizedBurnRate([0, 0, 0], 30)).toBe(0);
    });
  });

  describe("Single Source of Truth Stock Classifier (classifyStockStatus)", () => {
    test("returns CRITICAL when available stock is at or below safety stock", () => {
      const status = classifyStockStatus({
        available: 4,
        safetyStock: 5,
        reorderPoint: 8,
        leadTimeDays: 3,
        daysLeft: 2,
        totalDispatched: 30,
      });
      expect(status).toBe("CRITICAL");
    });

    test("returns CRITICAL when available stock is at or below dynamic reorder point", () => {
      const status = classifyStockStatus({
        available: 7,
        safetyStock: 5,
        reorderPoint: 10,
        leadTimeDays: 3,
        daysLeft: 2,
        totalDispatched: 30,
      });
      expect(status).toBe("CRITICAL");
    });

    test("returns LOW (warning) when days left is within leadTime + 3 days buffer", () => {
      const status = classifyStockStatus({
        available: 12,
        safetyStock: 5,
        reorderPoint: 10,
        leadTimeDays: 3,
        daysLeft: 5, // <= 3 + 3 = 6
        totalDispatched: 30,
      });
      expect(status).toBe("LOW");
    });

    test("returns OK when stock is healthy and well above reorder point (e.g. Hammer with 38 in stock, min 8)", () => {
      const status = classifyStockStatus({
        available: 38,
        safetyStock: 8,
        reorderPoint: 12,
        leadTimeDays: 3,
        daysLeft: 25,
        totalDispatched: 30,
      });
      expect(status).toBe("OK");
    });

    test("does NOT flag for reorder when totalDispatched is 0 and stock is healthy", () => {
      const status = classifyStockStatus({
        available: 35,
        safetyStock: 8,
        reorderPoint: 8,
        leadTimeDays: 3,
        daysLeft: null,
        totalDispatched: 0,
      });
      expect(status).toBe("OK");
    });

    test("flags CRITICAL for 0-dispatch item if physical stock is below minimum", () => {
      const status = classifyStockStatus({
        available: 3,
        safetyStock: 8,
        reorderPoint: 8,
        leadTimeDays: 3,
        daysLeft: null,
        totalDispatched: 0,
      });
      expect(status).toBe("CRITICAL");
    });
  });

  describe("Strict Reorder Suggestion Quantity Rules", () => {
    function computeSuggestedOrder({
      available,
      reorderPoint,
      safetyStock,
      avgDailyUsage,
      targetCoverDays = 30,
      minOrderQty = 10,
      totalDispatched = 30,
    }) {
      const isAtOrBelowReorderPoint = available <= reorderPoint || available <= safetyStock;
      if (!isAtOrBelowReorderPoint || (totalDispatched === 0 && available > safetyStock)) {
        return 0; // Show "—" in UI
      }
      const rawNeeded = Math.ceil(avgDailyUsage * targetCoverDays) + safetyStock - available;
      if (rawNeeded <= 0) return 0;
      return Math.ceil(rawNeeded / minOrderQty) * minOrderQty;
    }

    test("Hammer case: available 38 > reorder point 12 -> suggested reorder MUST be 0", () => {
      const suggested = computeSuggestedOrder({
        available: 38,
        reorderPoint: 12,
        safetyStock: 8,
        avgDailyUsage: 1.33,
        targetCoverDays: 30,
        minOrderQty: 15,
      });
      expect(suggested).toBe(0);
    });

    test("Screwdriver case: available 28 > reorder point 15 -> suggested reorder MUST be 0", () => {
      const suggested = computeSuggestedOrder({
        available: 28,
        reorderPoint: 15,
        safetyStock: 10,
        avgDailyUsage: 1.5,
        targetCoverDays: 30,
        minOrderQty: 20,
      });
      expect(suggested).toBe(0);
    });

    test("Drill case: available 4 <= reorder point 12 -> calculates valid MOQ-rounded order", () => {
      // 1.5/day * 30 cover = 45 units + 5 safety = 50 required. 50 - 4 = 46 net needed. MOQ 10 -> 50 units.
      const suggested = computeSuggestedOrder({
        available: 4,
        reorderPoint: 12,
        safetyStock: 5,
        avgDailyUsage: 1.5,
        targetCoverDays: 30,
        minOrderQty: 10,
      });
      expect(suggested).toBe(50);
    });
  });
});
