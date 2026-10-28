import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";

/**
 * Slow-Moving & Idle Stock Detection:
 * Flags items with positive stock that have zero dispatch movements in 30+ or 60+ days.
 * 30 days without dispatch -> WARNING
 * 60 days without dispatch -> CRITICAL
 */
export async function runSlowStock() {
  const warnDays = Number(process.env.SLOW_STOCK_WARN_DAYS) || 30;
  const critDays = Number(process.env.SLOW_STOCK_CRIT_DAYS) || 60;

  const now = new Date();
  const products = await Product.find({ isActive: { $ne: false }, stock: { $gt: 0 } }).lean();
  const insights = [];

  for (const product of products) {
    const lastDispatch = await StockMovement.findOne({
      product: product._id,
      type: "DISPATCH",
    })
      .sort({ createdAt: -1 })
      .lean();

    const referenceDate = lastDispatch ? new Date(lastDispatch.createdAt) : new Date(product.createdAt || now);
    const diffMs = now.getTime() - referenceDate.getTime();
    const daysSinceDispatch = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (daysSinceDispatch >= warnDays) {
      const isCritical = daysSinceDispatch >= critDays;
      const severity = isCritical ? "CRITICAL" : "WARNING";
      const unitCost = product.purchasePrice || product.sellingPrice || 0;
      const idleValue = product.stock * unitCost;

      insights.push({
        type: "SLOW_STOCK",
        severity,
        title: `Slow-Moving Stock: ${product.name}`,
        message: `${product.name} has had no dispatch activity for ${daysSinceDispatch} days with ₹${idleValue.toLocaleString("en-IN")} tied up in inventory.`,
        why: `Current inventory: ${product.stock} units on hand @ ₹${unitCost.toLocaleString("en-IN")}/unit (₹${idleValue.toLocaleString("en-IN")} idle value). Zero dispatches in ${daysSinceDispatch} days (threshold: ${isCritical ? critDays : warnDays} days).`,
        entityType: "PRODUCT",
        entityId: product._id.toString(),
        dedupeKey: `slow_stock_${product._id}`,
        metadata: {
          daysSinceDispatch,
          stock: product.stock,
          unitCost,
          idleValue,
        },
      });
    }
  }

  return insights;
}
