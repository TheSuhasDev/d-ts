import express from "express";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizeIndianPhone } from "../services/whatsappService.js";

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/customers
 * List/search customers for autocomplete
 */
router.get("/", async (req, res) => {
  try {
    const { q = "" } = req.query;
    const filter = {};
    if (q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [{ name: regex }, { phone: regex }, { gstin: regex }];
    }

    const customers = await Customer.find(filter).sort({ name: 1 }).limit(50);
    return res.json({ success: true, customers });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load customers", error: error.message });
  }
});

/**
 * GET /api/customers/:id
 * Customer profile with full ledger and order history
 */
router.get("/:id", async (req, res) => {
  try {
    const isObjectId = mongoose.isValidObjectId(req.params.id);
    const customer = isObjectId
      ? await Customer.findById(req.params.id)
      : await Customer.findOne({ phone: req.params.id });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Find all orders for this customer (matched by phone or gstin or client name)
    const phone = customer.phone;
    const orders = await Order.find({
      $or: [
        { "client.phone": phone },
        { "client.name": customer.name },
        ...(customer.gstin ? [{ "client.gstin": customer.gstin }] : []),
      ],
    }).sort({ createdAt: -1 });

    const totalOrders = orders.length;
    const totalBilled = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalPaid = orders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);
    const outstandingBalance = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + (o.balanceAmount || 0), 0);

    return res.json({
      success: true,
      customer,
      summary: {
        totalOrders,
        totalBilled,
        totalPaid,
        outstandingBalance,
      },
      orders,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load customer ledger", error: error.message });
  }
});

/**
 * POST /api/customers
 * Create new customer record
 */
router.post("/", async (req, res) => {
  try {
    const { name, phone, address, gstin = "", state = "Karnataka" } = req.body;
    if (!name?.trim() || !phone?.trim() || !address?.trim()) {
      return res.status(400).json({ success: false, message: "Name, phone, and address are required" });
    }

    const normalizedPhone = normalizeIndianPhone(phone) || phone.replace(/\D/g, "");
    const customer = await Customer.findOneAndUpdate(
      { phone: normalizedPhone },
      {
        $set: {
          name: name.trim(),
          phone: normalizedPhone,
          address: address.trim(),
          gstin: gstin.trim(),
          state: state.trim() || "Karnataka",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    return res.status(201).json({ success: true, customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to save customer" });
  }
});

/**
 * PUT /api/customers/:id
 * Update customer details
 */
router.put("/:id", async (req, res) => {
  try {
    const { name, phone, address, gstin, state } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (name) customer.name = name.trim();
    if (phone) customer.phone = normalizeIndianPhone(phone) || phone.replace(/\D/g, "");
    if (address) customer.address = address.trim();
    if (gstin !== undefined) customer.gstin = gstin.trim();
    if (state) customer.state = state.trim();

    await customer.save();
    return res.json({ success: true, customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update customer" });
  }
});

/**
 * GET /api/customers/:id/risk
 * Returns credit risk calculation (score 0-100, LOW/MEDIUM/HIGH, recommended advance %)
 */
router.get("/:id/risk", async (req, res) => {
  try {
    const { calculateCustomerRisk } = await import("../intelligence/modules/paymentRisk.js");
    const risk = await calculateCustomerRisk(req.params.id);
    return res.json({ success: true, risk });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to compute risk score" });
  }
});

export default router;
