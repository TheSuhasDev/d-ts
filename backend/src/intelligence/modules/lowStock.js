import { getReorderSuggestions } from "../../services/reorderService.js";

/**
 * Low Stock & Critical Replenishment Intelligence:
 * Single source of truth module aligned with reorderService & dashboard KPI.
 * Evaluates available stock against dynamic reorder points and safety thresholds.
 * CRITICAL -> Critical shortage needing immediate replenishment
 * WARNING -> Below dynamic reorder point (lead time buffer)
 */
export async function runLowStock() {
  const suggestions = await getReorderSuggestions({ days: 30 });
  const insights = [];

  for (const item of suggestions.items) {
    if (item.urgency === "CRITICAL" || item.urgency === "WARNING") {
      insights.push({
        type: "LOW_STOCK",
        severity: item.urgency === "CRITICAL" ? "CRITICAL" : "WARNING",
        title: `Low Stock Alert: ${item.name}`,
        message: item.message,
        why: item.reason,
        entityType: "PRODUCT",
        entityId: item.productId.toString(),
        dedupeKey: `low_stock_${item.productId}`,
        metadata: {
          stock: item.stock,
          available: item.available,
          reserved: item.reserved,
          minimumStock: item.minimumStock,
          suggestedReorder: item.suggestedReorder,
          avgDailyUsage: item.avgDailyUsage,
          daysLeft: item.daysLeft,
        },
      });
    }
  }

  return insights;
}
