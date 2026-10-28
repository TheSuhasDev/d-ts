describe("Decentralised Intelligence Mathematical Algorithms", () => {
  describe("Z-Score Demand Spike Mathematics", () => {
    function computeZScore(recentDispatches24h, baselineDailyDispatches) {
      if (!baselineDailyDispatches || baselineDailyDispatches.length === 0) {
        return { zScore: 0, mean: 0, stdDev: 0 };
      }

      const n = baselineDailyDispatches.length;
      const mean = baselineDailyDispatches.reduce((a, b) => a + b, 0) / n;

      const variance =
        baselineDailyDispatches.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) {
        return {
          zScore: recentDispatches24h > mean ? 3.5 : 0,
          mean,
          stdDev: 0,
        };
      }

      const zScore = (recentDispatches24h - mean) / stdDev;
      return {
        zScore: Math.round(zScore * 100) / 100,
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
      };
    }

    test("identifies critical demand spike when dispatches surge far above mean", () => {
      // 29 days of ~2 items daily (mean = 2, stdDev ~ 0.5)
      const baseline = [
        2, 2, 1, 3, 2, 2, 2, 1, 3, 2,
        2, 2, 1, 3, 2, 2, 2, 1, 3, 2,
        2, 2, 1, 3, 2, 2, 2, 1, 3,
      ];
      // Today: 12 dispatches
      const result = computeZScore(12, baseline);
      expect(result.mean).toBeCloseTo(2.0, 1);
      expect(result.zScore).toBeGreaterThanOrEqual(3.0); // Critical threshold is 3.0
    });

    test("returns normal Z-score for steady demand", () => {
      const baseline = [2, 3, 2, 4, 3, 2, 3, 2, 4, 3];
      const result = computeZScore(3, baseline);
      expect(Math.abs(result.zScore)).toBeLessThan(1.0);
    });

    test("handles zero standard deviation without divide-by-zero crash", () => {
      const baseline = [0, 0, 0, 0, 0];
      const result = computeZScore(10, baseline);
      expect(Number.isFinite(result.zScore)).toBe(true);
      expect(result.zScore).toBe(3.5);
    });
  });

  describe("Customer Credit Risk Scoring Formula", () => {
    function computeRiskScore({ totalBalance, avgDaysToPay, unpaidCount }) {
      // 1. Balance score (0 - 40 pts, capped at 50,000 INR)
      const balancePts = Math.min(40, (totalBalance / 50000) * 40);

      // 2. Days score (0 - 35 pts, scaled against 30 days)
      const daysPts = Math.min(35, (avgDaysToPay / 30) * 35);

      // 3. Unpaid count score (0 - 25 pts)
      const countPts = Math.min(25, unpaidCount * 8.33);

      const score = Math.min(100, Math.max(0, Math.round(balancePts + daysPts + countPts)));

      let tier = "LOW";
      let suggestedAdvancePercent = 30;
      if (score >= 70) {
        tier = "HIGH";
        suggestedAdvancePercent = 70;
      } else if (score >= 35) {
        tier = "MEDIUM";
        suggestedAdvancePercent = 50;
      }

      return {
        score,
        tier,
        suggestedAdvancePercent,
        balancePts: Math.round(balancePts * 10) / 10,
        daysPts: Math.round(daysPts * 10) / 10,
        countPts: Math.round(countPts * 10) / 10,
      };
    }

    test("classifies zero debt customer as LOW risk with 30% advance", () => {
      const res = computeRiskScore({ totalBalance: 0, avgDaysToPay: 0, unpaidCount: 0 });
      expect(res.score).toBe(0);
      expect(res.tier).toBe("LOW");
      expect(res.suggestedAdvancePercent).toBe(30);
    });

    test("classifies high debt, prolonged overdue customer as HIGH risk requiring 70% advance", () => {
      const res = computeRiskScore({
        totalBalance: 60000, // Capped at 40 pts
        avgDaysToPay: 25,    // (25/30) * 35 = 29.1 pts
        unpaidCount: 3,      // 3 * 8.33 = 25 pts
      });
      // 40 + 29.1 + 25 = 94.1 -> 94
      expect(res.score).toBeGreaterThanOrEqual(70);
      expect(res.tier).toBe("HIGH");
      expect(res.suggestedAdvancePercent).toBe(70);
    });

    test("classifies moderate debt customer as MEDIUM risk requiring 50% advance", () => {
      const res = computeRiskScore({
        totalBalance: 25000, // 20 pts
        avgDaysToPay: 15,    // 17.5 pts
        unpaidCount: 1,      // 8.33 pts
      });
      // 20 + 17.5 + 8.33 = 45.8 -> 46
      expect(res.score).toBeGreaterThanOrEqual(35);
      expect(res.score).toBeLessThan(70);
      expect(res.tier).toBe("MEDIUM");
      expect(res.suggestedAdvancePercent).toBe(50);
    });
  });

  describe("Stock Integrity Discrepancy Reconciliation", () => {
    function reconcileStock({ recordedStock, openingStock = 0, movements }) {
      let expected = openingStock;
      for (const m of movements) {
        if (m.type === "RECEIVE" || m.type === "RETURN") {
          expected += m.quantity;
        } else if (m.type === "DISPATCH" || m.type === "ADJUST_REDUCE") {
          expected -= m.quantity;
        }
      }

      const diff = recordedStock - expected;
      return {
        expectedStock: expected,
        recordedStock,
        discrepancy: diff,
        isConsistent: diff === 0,
      };
    }

    test("detects exact inventory balance consistency", () => {
      const movements = [
        { type: "RECEIVE", quantity: 50 },
        { type: "DISPATCH", quantity: 20 },
        { type: "RECEIVE", quantity: 10 },
      ];
      // Expected = 0 + 50 - 20 + 10 = 40
      const res = reconcileStock({ recordedStock: 40, openingStock: 0, movements });
      expect(res.isConsistent).toBe(true);
      expect(res.discrepancy).toBe(0);
    });

    test("flags missing units when recorded stock is less than ledger expectation", () => {
      const movements = [
        { type: "RECEIVE", quantity: 50 },
        { type: "DISPATCH", quantity: 22 },
      ];
      // Expected = 28, but recorded is 25 (-3 units lost/damaged)
      const res = reconcileStock({ recordedStock: 25, openingStock: 0, movements });
      expect(res.isConsistent).toBe(false);
      expect(res.discrepancy).toBe(-3);
    });
  });

  describe("Order Flow Overdue Reminder Ladder", () => {
    function getReminderLadderStage(overdueDays) {
      if (overdueDays >= 14) return "FINAL_NOTICE";
      if (overdueDays >= 7) return "2ND_REMINDER";
      if (overdueDays >= 3) return "1ST_REMINDER";
      return "NONE";
    }

    test("escalates reminders appropriately through 3/7/14 day ladder", () => {
      expect(getReminderLadderStage(1)).toBe("NONE");
      expect(getReminderLadderStage(2)).toBe("NONE");
      expect(getReminderLadderStage(3)).toBe("1ST_REMINDER");
      expect(getReminderLadderStage(5)).toBe("1ST_REMINDER");
      expect(getReminderLadderStage(7)).toBe("2ND_REMINDER");
      expect(getReminderLadderStage(10)).toBe("2ND_REMINDER");
      expect(getReminderLadderStage(14)).toBe("FINAL_NOTICE");
      expect(getReminderLadderStage(25)).toBe("FINAL_NOTICE");
    });
  });
});
