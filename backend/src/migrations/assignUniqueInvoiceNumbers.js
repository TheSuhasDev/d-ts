import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import { getNextSequence, getFinancialYearCode } from "../services/sequenceService.js";

dotenv.config();

export async function assignUniqueInvoiceNumbers() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not configured in .env");
    return;
  }

  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    await mongoose.connect(mongoUri);
  }

  console.log("[Migration] Checking all orders for missing or duplicate invoice numbers...");

  const orders = await Order.find({}).sort({ createdAt: 1 });
  const seenInvoices = new Set();
  let updatedCount = 0;

  for (const order of orders) {
    let needsNewInvoice = false;

    if (!order.invoiceNumber || typeof order.invoiceNumber !== "string" || order.invoiceNumber.trim() === "") {
      needsNewInvoice = true;
    } else if (seenInvoices.has(order.invoiceNumber)) {
      console.warn(`Duplicate invoice detected on order ${order.orderNumber}: ${order.invoiceNumber}`);
      needsNewInvoice = true;
    }

    if (needsNewInvoice) {
      const newInvoiceNumber = await getNextSequence("INV", order.createdAt || new Date());
      order.invoiceNumber = newInvoiceNumber;
      await Order.updateOne({ _id: order._id }, { $set: { invoiceNumber: newInvoiceNumber } });
      seenInvoices.add(newInvoiceNumber);
      updatedCount++;
      console.log(`Assigned new unique invoice ${newInvoiceNumber} to order ${order.orderNumber}`);
    } else {
      seenInvoices.add(order.invoiceNumber);
    }
  }

  // Ensure Counter sequence for current FY is at least equal to the max invoice number
  const currentFy = getFinancialYearCode(new Date());
  const invKey = `INV_${currentFy}`;
  let maxSeq = 0;
  for (const inv of seenInvoices) {
    const match = inv.match(/INV\/\d{2}-\d{2}\/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }

  if (maxSeq > 0) {
    await Counter.findOneAndUpdate(
      { key: invKey, seq: { $lt: maxSeq } },
      { $set: { seq: maxSeq } }
    );
  }

  console.log(`[Migration] Unique invoice validation complete. Updated ${updatedCount} orders. Counter at ${maxSeq}.`);
}

// Run standalone if invoked directly
if (process.argv[1] && process.argv[1].includes("assignUniqueInvoiceNumbers")) {
  assignUniqueInvoiceNumbers().then(() => {
    console.log("[Migration] Migration finished successfully.");
    process.exit(0);
  }).catch((err) => {
    console.error("[Migration] Migration failed:", err);
    process.exit(1);
  });
}
