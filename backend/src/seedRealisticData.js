import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import Product from "./models/Product.js";
import Customer from "./models/Customer.js";
import Order from "./models/Order.js";
import StockMovement from "./models/StockMovement.js";
import Payment from "./models/Payment.js";
import { runIntelligenceEngine } from "./intelligence/index.js";
import { getNextOrderNumber, getNextInvoiceNumber } from "./services/sequenceService.js";

dotenv.config();

export async function seedRealisticData() {
  await connectDB();
  console.log("[Seed] Connected to database. Seeding realistic warehouse scenario data...");

  // 1. Upsert Realistic Products
  const productsDef = [
    {
      name: "Drill",
      sku: "DRL001",
      purchasePrice: 1200,
      sellingPrice: 1650,
      stock: 14,
      minimumStock: 5,
      leadTimeDays: 5,
      minOrderQty: 10,
      supplier: { name: "Apex Power Tools Ltd", phone: "+91 98450 11223" },
      location: "Bay A - Shelf 01",
      hsn: "8467",
      gstPercent: 18,
      isActive: true,
    },
    {
      name: "Hammer",
      sku: "HAM001",
      purchasePrice: 280,
      sellingPrice: 420,
      stock: 35,
      minimumStock: 8,
      leadTimeDays: 3,
      minOrderQty: 15,
      supplier: { name: "Stanley Hardware Depot", phone: "+91 98450 22334" },
      location: "Bay A - Shelf 02",
      hsn: "8205",
      gstPercent: 18,
      isActive: true,
    },
    {
      name: "Pliers",
      sku: "PLR001",
      purchasePrice: 220,
      sellingPrice: 350,
      stock: 28,
      minimumStock: 6,
      leadTimeDays: 4,
      minOrderQty: 12,
      supplier: { name: "Taparia Tools Agency", phone: "+91 98450 33445" },
      location: "Bay B - Shelf 01",
      hsn: "8203",
      gstPercent: 18,
      isActive: true,
    },
    {
      name: "Screwdriver",
      sku: "SCR001",
      purchasePrice: 110,
      sellingPrice: 180,
      stock: 25, // Discrepancy: physical stock is 25, but movement ledger will total 28!
      minimumStock: 10,
      leadTimeDays: 3,
      minOrderQty: 25,
      supplier: { name: "Anchor Hand Tools", phone: "+91 98450 44556" },
      location: "Bay B - Shelf 02",
      hsn: "8205",
      gstPercent: 18,
      isActive: true,
    },
    {
      name: "Wrench",
      sku: "WRC001",
      purchasePrice: 320,
      sellingPrice: 500,
      stock: 22,
      minimumStock: 6,
      leadTimeDays: 7,
      minOrderQty: 10,
      supplier: { name: "Eastman Cast & Forge", phone: "+91 98450 55667" },
      location: "Bay C - Shelf 01",
      hsn: "8204",
      gstPercent: 18,
      isActive: true,
    },
  ];

  const productMap = new Map();
  for (const p of productsDef) {
    const doc = await Product.findOneAndUpdate(
      { sku: p.sku },
      { $set: p },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    productMap.set(p.sku, doc);
  }
  console.log(`[Seed] ${productMap.size} products verified/upserted.`);

  // 2. Clear old movements and orders for clean reproducible demo
  await StockMovement.deleteMany({});
  await Order.deleteMany({});
  await Payment.deleteMany({});
  await Customer.deleteMany({});
  console.log("[Seed] Cleared legacy demo transactions.");

  const now = new Date();

  // 3. Customers
  const customerGood = await Customer.create({
    name: "Karnataka Toolings & Fabrication",
    phone: "+91 98765 11111",
    address: "Plot 42, Peenya Industrial Area, Stage 2, Bangalore, Karnataka - 560058",
    gstin: "29AABCK1234F1Z1",
    state: "Karnataka",
  });

  const customerLate = await Customer.create({
    name: "MegaBuild Infrastructure Pvt Ltd",
    phone: "+91 98765 43210",
    address: "Tower B, Outer Ring Road Tech Park, Bangalore, Karnataka - 560103",
    gstin: "29AABCM9876Q1Z9",
    state: "Karnataka",
  });

  console.log("[Seed] 2 demo customers seeded (Good vs High Risk).");

  // 4. Seed 30-Day Historical Stock Movements
  const drill = productMap.get("DRL001");
  const hammer = productMap.get("HAM001");
  const pliers = productMap.get("PLR001");
  const screwdriver = productMap.get("SCR001");
  const wrench = productMap.get("WRC001");

  // Initial Receives (35 days ago)
  const initialReceiveDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  await StockMovement.create([
    {
      product: drill._id,
      type: "RECEIVE",
      quantity: 50,
      beforeStock: 0,
      afterStock: 50,
      userName: "Inventory Manager",
      reason: "Initial baseline stock receipt",
      createdAt: initialReceiveDate,
    },
    {
      product: hammer._id,
      type: "RECEIVE",
      quantity: 60,
      beforeStock: 0,
      afterStock: 60,
      userName: "Inventory Manager",
      reason: "Initial baseline stock receipt",
      createdAt: initialReceiveDate,
    },
    {
      product: pliers._id,
      type: "RECEIVE",
      quantity: 50,
      beforeStock: 0,
      afterStock: 50,
      userName: "Inventory Manager",
      reason: "Initial baseline stock receipt",
      createdAt: initialReceiveDate,
    },
    {
      product: screwdriver._id,
      type: "RECEIVE",
      quantity: 50,
      beforeStock: 0,
      afterStock: 50,
      userName: "Inventory Manager",
      reason: "Initial baseline stock receipt",
      createdAt: initialReceiveDate,
    },
    {
      product: wrench._id,
      type: "RECEIVE",
      quantity: 30,
      beforeStock: 0,
      afterStock: 30,
      userName: "Inventory Manager",
      reason: "Initial baseline stock receipt",
      createdAt: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), // 50 days ago
    },
  ]);

  // Baseline steady dispatches across past 30 days
  let drillRunningStock = 50;
  for (let day = 28; day >= 2; day--) {
    const movementDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
    // Steady ~1-2 units/day for Drill
    const qty = (day % 3 === 0) ? 2 : 1;
    drillRunningStock -= qty;

    await StockMovement.create({
      product: drill._id,
      type: "DISPATCH",
      quantity: qty,
      beforeStock: drillRunningStock + qty,
      afterStock: drillRunningStock,
      userName: "Dispatch Staff",
      reason: "Regular client order fulfillment",
      createdAt: movementDate,
    });
  }

  // A) DEMAND SPIKE: In the last 12 hours, Drill had a sudden surge of 15 units dispatched!
  await StockMovement.create({
    product: drill._id,
    type: "DISPATCH",
    quantity: 15,
    beforeStock: drillRunningStock,
    afterStock: drillRunningStock - 15,
    userName: "Express Logistics",
    reason: "Urgent bulk industrial order dispatch",
    createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4h ago
  });
  console.log("[Seed] Drill (DRL001) seeded with demand spike surge.");

  // B) SLOW STOCK: Wrench (WRC001) had 1 dispatch 45 days ago, zero dispatches in past 44 days!
  await StockMovement.create({
    product: wrench._id,
    type: "DISPATCH",
    quantity: 8,
    beforeStock: 30,
    afterStock: 22,
    userName: "Dispatch Staff",
    reason: "Project order dispatch",
    createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago!
  });
  console.log("[Seed] Wrench (WRC001) seeded with 45-day slow moving dormancy.");

  // C) STOCK INTEGRITY MISMATCH:
  // Screwdriver recorded 22 units dispatched from 50, leaving expected 28 units.
  // But product.stock is set to 25! (3 units missing from ledger).
  await StockMovement.create({
    product: screwdriver._id,
    type: "DISPATCH",
    quantity: 22,
    beforeStock: 50,
    afterStock: 28, // Expected 28, but Product.stock is 25
    userName: "Dispatch Staff",
    reason: "Bulk kit dispatch",
    createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
  });
  console.log("[Seed] Screwdriver (SCR001) seeded with -3 units ledger mismatch.");

  // D) STUCK ORDERS & OVERDUE PAYMENT LADDER:
  // 1. Stuck in PROCESSING (Created 4 days ago)
  const stuckOrderNumber = await getNextOrderNumber();
  await Order.create({
    orderNumber: stuckOrderNumber,
    client: {
      name: "Karnataka Toolings & Fabrication",
      phone: "+91 98765 11111",
      address: customerGood.address,
      gstin: customerGood.gstin,
    },
    items: [
      { product: hammer._id, name: hammer.name, sku: hammer.sku, quantity: 5, unitPrice: hammer.sellingPrice },
    ],
    totalAmount: 2100,
    advancePercentage: 30,
    advanceRequired: 630,
    totalPaid: 0,
    advanceAmount: 0,
    balanceAmount: 2100,
    paymentStatus: "ADVANCE_PENDING",
    status: "PROCESSING",
    createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
  });

  // 2. Stuck in PACKED / Critical Overdue Payment Ladder (Packed 16 days ago, balance ₹14,500)
  const overdueOrderNumber = await getNextOrderNumber();
  const overdueInvoiceNumber = await getNextInvoiceNumber();
  await Order.create({
    orderNumber: overdueOrderNumber,
    invoiceNumber: overdueInvoiceNumber,
    client: {
      name: "MegaBuild Infrastructure Pvt Ltd",
      phone: customerLate.phone,
      address: customerLate.address,
      gstin: customerLate.gstin,
    },
    items: [
      { product: drill._id, name: drill.name, sku: drill.sku, quantity: 8, unitPrice: drill.sellingPrice },
      { product: pliers._id, name: pliers.name, sku: pliers.sku, quantity: 10, unitPrice: pliers.sellingPrice },
    ],
    totalAmount: 16700,
    advancePercentage: 30,
    advanceRequired: 5010,
    totalPaid: 5010,
    advanceAmount: 5010,
    balanceAmount: 11690,
    paymentStatus: "FULL_PAYMENT_PENDING",
    status: "PACKED",
    packedAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
    createdAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
  });

  // 3. Second Unpaid Order for MegaBuild (Total unpaid debt > ₹50,000 -> HIGH RISK score >= 70)
  const secondDebtOrderNumber = await getNextOrderNumber();
  await Order.create({
    orderNumber: secondDebtOrderNumber,
    client: {
      name: "MegaBuild Infrastructure Pvt Ltd",
      phone: customerLate.phone,
      address: customerLate.address,
      gstin: customerLate.gstin,
    },
    items: [
      { product: hammer._id, name: hammer.name, sku: hammer.sku, quantity: 30, unitPrice: hammer.sellingPrice },
      { product: wrench._id, name: wrench.name, sku: wrench.sku, quantity: 20, unitPrice: wrench.sellingPrice },
    ],
    totalAmount: 45000,
    advancePercentage: 30,
    advanceRequired: 13500,
    totalPaid: 0,
    advanceAmount: 0,
    balanceAmount: 45000,
    paymentStatus: "ADVANCE_PENDING",
    status: "PROCESSING",
    createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
  });

  console.log("[Seed] Stuck orders and MegaBuild credit risk scenarios seeded.");

  // 5. Run the Intelligence Engine cycle now to generate all insights!
  console.log("[Seed] Triggering intelligence engine to generate insights from seeded data...");
  const engineResult = await runIntelligenceEngine();
  console.log("[Seed] Intelligence Engine run finished:", engineResult);

  console.log("[Seed] Realistic scenario seeding fully completed!");
}

// Auto-execute if invoked directly via CLI
if (process.argv[1]?.endsWith("seedRealisticData.js")) {
  seedRealisticData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed] Error seeding data:", err);
      process.exit(1);
    });
}
