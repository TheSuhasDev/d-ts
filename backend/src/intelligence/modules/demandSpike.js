import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";

/**
 * Demand Spike Detection:
 * Evaluates dispatch volume in the last 24 hours against 30-day baseline daily distribution.
 * Calculates standard score (Z-score).
 * Z >= 3.0 -> CRITICAL
 * Z >= 2.0 -> WARNING
 */
export async function runDemandSpike() {
  const zWarnThreshold = Number(process.env.DEMAND_SPIKE_Z_WARN) || 2.0;
  const zCritThreshold = Number(process.env.DEMAND_SPIKE_Z_CRIT) || 3.0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const products = await Product.find({ isActive: { $ne: false } }).lean();
  const insights = [];

  for (const product of products) {
    const movements = await StockMovement.find({
      product: product._id,
      type: "DISPATCH",
      createdAt: { $gte: thirtyDaysAgo },
    })
      .sort({ createdAt: 1 })
      .lean();

    // Skip products with too little history
    if (movements.length < 5) continue;

    // Daily bucket calculation over 30 days
    const dailyMap = new Map();
    for (let d = 0; d < 30; d++) {
      const dayKey = new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dailyMap.set(dayKey, 0);
    }

    let qty24h = 0;
    for (const m of movements) {
      const dayKey = new Date(m.createdAt).toISOString().slice(0, 10);
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + m.quantity);
      if (new Date(m.createdAt) >= oneDayAgo) {
        qty24h += m.quantity;
      }
    }

    const dailyValues = Array.from(dailyMap.values());
    const sum = dailyValues.reduce((a, b) => a + b, 0);
    const mean = sum / dailyValues.length;
    const variance = dailyValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dailyValues.length;
    const std = Math.sqrt(variance);

    if (std < 0.1 || qty24h < 3) continue;

    const zScore = (qty24h - mean) / std;

    if (zScore >= zWarnThreshold) {
      const isCritical = zScore >= zCritThreshold;
      const severity = isCritical ? "CRITICAL" : "WARNING";

      insights.push({
        type: "DEMAND_SPIKE",
        severity,
        title: `Demand Spike: ${product.name}`,
        message: `Surge in dispatch activity for ${product.name}. 24h dispatches (${qty24h} units) significantly exceed baseline.`,
        why: `Last 24h dispatched: ${qty24h} units. 30-day baseline average: ${mean.toFixed(1)} units/day (standard deviation: ${std.toFixed(1)}). Z-score: ${zScore.toFixed(2)} (>= ${isCritical ? zCritThreshold : zWarnThreshold}).`,
        entityType: "PRODUCT",
        entityId: product._id.toString(),
        dedupeKey: `demand_spike_${product._id}`,
        metadata: {
          zScore: Number(zScore.toFixed(2)),
          qty24h,
          dailyMean: Number(mean.toFixed(2)),
          std: Number(std.toFixed(2)),
        },
      });
    }
  }

  return insights;
}
