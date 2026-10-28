import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";

dotenv.config();

export async function backfillDispatchMovements() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not configured in .env");
    return;
  }

  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    await mongoose.connect(mongoUri);
  }

  console.log("[Migration] Running idempotent backfill of order references on dispatch movements...");

  // Find all orders that have been dispatched or have items
  const orders = await Order.find({}).sort({ createdAt: 1 });
  let matchedCount = 0;

  for (const order of orders) {
    if (!order.orderNumber || !Array.isArray(order.items)) continue;

    for (const item of order.items) {
      const productId = item.product;
      const qty = item.quantity;
      if (!productId || !qty) continue;

      // Find an unmatched DISPATCH movement for this product and quantity without orderNumber
      const movement = await StockMovement.findOne({
        product: productId,
        type: "DISPATCH",
        quantity: qty,
        $or: [{ orderNumber: { $exists: false } }, { orderNumber: null }, { orderNumber: "" }],
      }).sort({ createdAt: 1 });

      if (movement) {
        movement.orderId = order._id;
        movement.orderNumber = order.orderNumber;
        movement.note = `Order ${order.orderNumber} dispatched to ${order.client?.name || "Customer"}`;
        await movement.save();
        matchedCount++;
      }
    }
  }

  // For any remaining dispatch movements without orderNumber, assign standard reference note
  const remainingDispatches = await StockMovement.find({
    type: "DISPATCH",
    $or: [{ orderNumber: { $exists: false } }, { orderNumber: null }, { orderNumber: "" }],
  });

  for (const m of remainingDispatches) {
    m.note = m.note || "Warehouse operational dispatch";
    await m.save();
  }

  console.log(`[Migration] Backfilled ${matchedCount} dispatch movements with order references.`);
}

// Run standalone if invoked directly
if (process.argv[1] && process.argv[1].includes("backfillDispatchMovements")) {
  backfillDispatchMovements().then(() => {
    console.log("[Migration] Backfill complete.");
    process.exit(0);
  }).catch((err) => {
    console.error("[Migration] Backfill failed:", err);
    process.exit(1);
  });
}
