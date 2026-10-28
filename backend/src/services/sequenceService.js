import Counter from "../models/Counter.js";
import Order from "../models/Order.js";

/**
 * Calculates Indian Financial Year string (e.g., '26-27' for FY 2026-2027)
 */
export function getFinancialYearCode(date = new Date()) {
  const d = new Date(date);
  const month = d.getMonth(); // 0 is January, 3 is April
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

/**
 * Atomically generates next sequential gap-free number for an entity type and financial year
 * Format: ORD/26-27/0001 or INV/26-27/0001
 */
export async function getNextSequence(type = "ORD", date = new Date()) {
  const fyCode = getFinancialYearCode(date);
  const key = `${type.toUpperCase()}_${fyCode}`;

  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(4, "0");
  return `${type.toUpperCase()}/${fyCode}/${paddedSeq}`;
}

export async function getNextOrderNumber(date = new Date()) {
  return getNextSequence("ORD", date);
}

export async function getNextInvoiceNumber(date = new Date()) {
  return getNextSequence("INV", date);
}

/**
 * Backfills missing invoiceNumber and standardizes orderNumber on legacy orders without breaking them
 */
export async function backfillOrderNumbers() {
  try {
    const ordersWithoutInvoice = await Order.find({
      $or: [
        { invoiceNumber: { $exists: false } },
        { invoiceNumber: null },
        { invoiceNumber: "" },
      ],
    }).sort({ createdAt: 1 });

    for (const order of ordersWithoutInvoice) {
      const orderDate = order.createdAt || new Date();
      const invoiceNumber = await getNextSequence("INV", orderDate);
      order.invoiceNumber = invoiceNumber;

      // If orderNumber is legacy ORD-<timestamp>-<rand>, we can preserve it for backwards compatibility
      // while providing the invoiceNumber
      await Order.updateOne(
        { _id: order._id },
        { $set: { invoiceNumber } }
      );
    }

    if (ordersWithoutInvoice.length > 0) {
      console.log(`Backfilled sequential invoice numbers for ${ordersWithoutInvoice.length} legacy orders.`);
    }
  } catch (error) {
    console.error("Error backfilling order sequences:", error);
  }
}
