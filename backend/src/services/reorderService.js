import Product from "../models/Product.js";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";

/**
 * Calculates real-time reserved stock across all active/unfulfilled orders
 */
export async function getReservedStockMap() {
  const activeOrders = await Order.find({
    status: { $in: ["PROCESSING", "ADVANCE_RECEIVED", "PACKED"] },
  }).select("items");

  const reservedMap = new Map();
  for (const order of activeOrders) {
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          const pid = String(item.product);
          reservedMap.set(pid, (reservedMap.get(pid) || 0) + Number(item.quantity || 0));
        }
      }
    }
  }
  return reservedMap;
}

/**
 * Calculates outlier-robust daily burn rate using winsorization (capped at mean + 3 * stdDev).
 * Prevents single-day spikes (e.g. 17 or 23 units in test data) from inflating reorder demand.
 */
export function calculateWinsorizedBurnRate(dailyDispatches = [], windowDays = 30) {
  if (!Array.isArray(dailyDispatches) || dailyDispatches.length === 0) return 0;
  
  // Pad with zeroes for days with zero dispatches
  const padded = [...dailyDispatches];
  while (padded.length < windowDays) {
    padded.push(0);
  }
  const series = padded.slice(0, windowDays);

  const sum = series.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  const mean = sum / windowDays;
  const variance = series.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / windowDays;
  const stdDev = Math.sqrt(variance);

  // Cap at 3 standard deviations above mean
  const outlierCap = stdDev > 0 ? mean + 3 * stdDev : mean;

  const winsorizedSum = series.reduce((acc, val) => acc + Math.min(val, outlierCap), 0);
  return Math.round((winsorizedSum / windowDays) * 100) / 100;
}

/**
 * Single source of truth for stock status classification (OK / LOW / CRITICAL)
 * Used consistently across Dashboard KPI, Smart Reorder, and Warehouse Intelligence.
 */
export function classifyStockStatus({
  available,
  onHand,
  safetyStock,
  reorderPoint,
  leadTimeDays = 3,
  daysLeft = null,
  totalDispatched = 0,
}) {
  const avail = Number(available) !== undefined && !isNaN(Number(available)) ? Number(available) : (Number(onHand) || 0);
  const physical = Number(onHand) !== undefined && !isNaN(Number(onHand)) ? Number(onHand) : avail;
  const safety = Number(safetyStock) || 0;
  const rop = Number(reorderPoint) || safety;

  // If no dispatches recorded in 30 days, do NOT flag for reorder unless physical stock is below minimum
  if (totalDispatched === 0) {
    return physical < safety ? "CRITICAL" : "OK";
  }

  // Immediate critical shortage: on-hand available is at or below safety stock
  if (avail <= safety) {
    return "CRITICAL";
  }

  // Stock is at or below dynamic reorder point, or stock run-out is within supplier lead time
  if (avail <= rop || (daysLeft !== null && daysLeft <= leadTimeDays)) {
    return "CRITICAL";
  }

  // Warning zone: running out within lead time + 3 buffer days
  if (daysLeft !== null && daysLeft <= leadTimeDays + 3) {
    return "LOW";
  }

  return "OK";
}

/**
 * Computes single source of truth for Smart Reorder Telemetry.
 */
export async function getReorderSuggestions({ days = 30, coverDays = 30 } = {}) {
  const windowDays = Math.min(90, Math.max(7, Number(days) || 30));
  const targetCoverDays = Math.max(1, Number(coverDays) || 30);
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Group dispatches per product per day for outlier-robust winsorized burn rate
  const [dailyDispatchesGrouped, products, reservedMap] = await Promise.all([
    StockMovement.aggregate([
      {
        $match: {
          type: "DISPATCH",
          createdAt: { $gte: windowStart },
        },
      },
      {
        $group: {
          _id: {
            product: "$product",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          dailyQty: { $sum: "$quantity" },
        },
      },
    ]),
    Product.find({ isActive: { $ne: false } }).sort({ name: 1 }),
    getReservedStockMap(),
  ]);

  // Build map of product -> array of daily dispatch quantities
  const productDailyMap = new Map();
  for (const entry of dailyDispatchesGrouped) {
    const pidStr = entry._id.product.toString();
    if (!productDailyMap.has(pidStr)) {
      productDailyMap.set(pidStr, []);
    }
    productDailyMap.get(pidStr).push(Number(entry.dailyQty) || 0);
  }

  const items = products.map((product) => {
    const pidStr = product._id.toString();
    const onHand = product.stock;
    const reserved = reservedMap.get(pidStr) || 0;
    const available = Math.max(0, onHand - reserved);

    const dailyQuantities = productDailyMap.get(pidStr) || [];
    const totalDispatched = dailyQuantities.reduce((a, b) => a + b, 0);

    // Outlier-robust winsorized burn rate
    const avgDailyUsage = calculateWinsorizedBurnRate(dailyQuantities, windowDays);

    const leadTime = Number(product.leadTimeDays) || 3;
    const minOrderQty = Number(product.minOrderQty) || 5;
    const safetyStock = Number(product.minimumStock) || 5;

    const daysLeft =
      avgDailyUsage > 0
        ? Math.round((available / avgDailyUsage) * 10) / 10
        : null;

    // Dynamic Reorder Point = avgDailyUsage * leadTime + safetyStock
    const reorderPoint = Math.round((avgDailyUsage * leadTime + safetyStock) * 10) / 10;

    // Single source of truth stock classifier
    const status = classifyStockStatus({
      available,
      onHand,
      safetyStock,
      reorderPoint,
      leadTimeDays: leadTime,
      daysLeft,
      totalDispatched,
    });

    // Urgency mapping: "CRITICAL" | "WARNING" (LOW) | "NO_DATA" | "OK"
    let urgency = "OK";
    let suggestedReorder = 0;
    const isAtOrBelowReorderPoint = available <= reorderPoint;

    if (totalDispatched === 0) {
      if (onHand < safetyStock) {
        urgency = "CRITICAL";
        const rawNeeded = safetyStock - available;
        suggestedReorder = Math.ceil(Math.max(rawNeeded, minOrderQty) / minOrderQty) * minOrderQty;
      } else {
        urgency = "OK";
        suggestedReorder = 0;
      }
    } else if (isAtOrBelowReorderPoint) {
      if (status === "CRITICAL") {
        urgency = "CRITICAL";
      } else if (status === "LOW") {
        urgency = "WARNING";
      } else {
        urgency = "OK";
      }
      const rawNeeded = Math.ceil(avgDailyUsage * targetCoverDays) + safetyStock - available;
      if (rawNeeded > 0) {
        suggestedReorder = Math.ceil(rawNeeded / minOrderQty) * minOrderQty;
      }
    } else {
      // Stock is above reorder point: show "—" and status OK
      urgency = "OK";
      suggestedReorder = 0;
    }

    let message;
    if (urgency === "NO_DATA") {
      message = `${product.name} has no dispatches in ${windowDays} days; stock is healthy`;
    } else if (available === 0) {
      message = `${product.name} has 0 available units (${onHand} on hand, ${reserved} reserved)`;
    } else if (urgency === "CRITICAL") {
      message = `${product.name} is CRITICAL: available ${available} is at or below threshold (${safetyStock} min, ${reorderPoint} ROP)`;
    } else if (daysLeft !== null && daysLeft <= leadTime + 3) {
      message = `${product.name} will reach safety threshold in ~${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    } else {
      message = `${product.name} stock level is healthy (${available} available, above ROP ${reorderPoint})`;
    }

    const reason = `Robust burn rate: ${avgDailyUsage.toFixed(2)}/day over ${windowDays}d. ROP: ${reorderPoint} (Lead: ${leadTime}d, Safety: ${safetyStock}). Available: ${available} (${onHand} on hand, ${reserved} reserved). ${
      suggestedReorder > 0
        ? `Suggested reorder: ${suggestedReorder} units (MOQ batch: ${minOrderQty}).`
        : `Stock is above reorder point (${available} > ${reorderPoint}). No reorder required.`
    }`;

    return {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl || "",
      stock: onHand,
      onHand,
      reserved,
      available,
      minimumStock: safetyStock,
      leadTimeDays: leadTime,
      minOrderQty,
      supplier: product.supplier || { name: "Standard Supplier", phone: "" },
      totalDispatched,
      avgDailyUsage,
      daysLeft,
      reorderPoint,
      suggestedReorder,
      urgency,
      status, // OK, LOW, CRITICAL
      message,
      reason,
    };
  });

  const urgencyRank = {
    CRITICAL: 0,
    WARNING: 1,
    NO_DATA: 2,
    OK: 3,
  };

  items.sort((a, b) => {
    const rankDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (rankDiff !== 0) return rankDiff;
    if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
    if (a.daysLeft !== null) return -1;
    if (b.daysLeft !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const criticalItems = items.filter((i) => i.urgency === "CRITICAL");
  const warningItems = items.filter((i) => i.urgency === "WARNING");
  const reorderNeededItems = items.filter((i) => i.suggestedReorder > 0);

  return {
    windowDays,
    coverDays: targetCoverDays,
    items,
    criticalCount: criticalItems.length,
    warningCount: warningItems.length,
    reorderNeededCount: reorderNeededItems.length,
    reorderNeededItems,
  };
}
