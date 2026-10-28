import Product from "../../models/Product.js";
import StockMovement from "../../models/StockMovement.js";

/**
 * Stock Ledger Integrity Verification:
 * Validates current product stock against the sequential transaction ledger in StockMovement.
 * Flags any divergence between recorded product.stock and historical movement ledger.
 * Any mismatch = CRITICAL
 */
export async function runStockIntegrity() {
  const products = await Product.find({}).lean();
  const insights = [];

  for (const product of products) {
    const movements = await StockMovement.find({ product: product._id })
      .sort({ createdAt: 1 })
      .lean();

    if (movements.length === 0) continue;

    // Check 1: If latest movement recorded afterStock, it must equal current stock
    const latestMovement = movements[movements.length - 1];
    let discrepancy = null;
    let expectedStock = null;

    if (latestMovement.afterStock !== undefined && latestMovement.afterStock !== null) {
      if (latestMovement.afterStock !== product.stock) {
        expectedStock = latestMovement.afterStock;
        discrepancy = product.stock - expectedStock;
      }
    } else {
      // Check 2: Sequential delta calculation
      let runningStock = movements[0].beforeStock !== undefined ? movements[0].beforeStock : 0;
      for (const m of movements) {
        if (m.type === "RECEIVE" || m.type === "RETURN") {
          runningStock += m.quantity;
        } else if (m.type === "DISPATCH") {
          runningStock -= m.quantity;
        } else if (m.type === "ADJUSTMENT") {
          if (m.afterStock !== undefined && m.beforeStock !== undefined) {
            runningStock += (m.afterStock - m.beforeStock);
          } else {
            runningStock += m.quantity;
          }
        }
      }

      if (runningStock !== product.stock) {
        expectedStock = runningStock;
        discrepancy = product.stock - expectedStock;
      }
    }

    if (discrepancy !== null && discrepancy !== 0) {
      const sign = discrepancy > 0 ? `+${discrepancy}` : `${discrepancy}`;

      insights.push({
        type: "STOCK_INTEGRITY",
        severity: "CRITICAL",
        title: `Stock Ledger Mismatch: ${product.name}`,
        message: `Inventory ledger discrepancy detected for ${product.name}. Current stock is ${product.stock}, but transaction ledger expects ${expectedStock}.`,
        why: `Current product stock in database: ${product.stock} units. Expected ledger stock: ${expectedStock} units (discrepancy: ${sign} units across ${movements.length} logged movements). Immediate physical audit recommended.`,
        entityType: "PRODUCT",
        entityId: product._id.toString(),
        dedupeKey: `stock_integrity_${product._id}`,
        metadata: {
          productStock: product.stock,
          expectedStock,
          discrepancy,
          movementCount: movements.length,
        },
      });
    }
  }

  return insights;
}
