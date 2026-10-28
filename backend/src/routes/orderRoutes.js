import express from "express";
import mongoose from "mongoose";
import Order, { markOrderPacked } from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import StockMovement from "../models/StockMovement.js";
import { DEFAULT_ADVANCE_PERCENTAGE } from "../config/orderSettings.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { runInTransaction } from "../config/database.js";
import { validateBody } from "../middleware/validate.js";
import {
  createOrderSchema,
  recordPaymentSchema,
  cancelOrderSchema,
  salesReturnSchema,
} from "../schemas/index.js";
import { generateInvoicePDF } from "../services/pdfService.js";
import {
  sendInvoiceViaWhatsAppCloud,
  isWhatsAppCloudConfigured,
  normalizeIndianPhone,
} from "../services/whatsappService.js";
import { getNextSequence } from "../services/sequenceService.js";
import { getReservedStockMap } from "./productRoutes.js";

const router = express.Router();

// Public Invoice PDF stream for customer direct receipt link via WhatsApp (No auth required)
router.get("/public/:id/invoice.pdf", async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;

    if (mongoose.isValidObjectId(id)) {
      order = await Order.findById(id).populate("items.product", "name sku");
    } else {
      // Decode and check invoiceNumber or orderNumber (handles INV-26-27-0007 <-> INV/26-27/0007)
      const decoded = decodeURIComponent(id).trim();
      const slashVersion = decoded.replace(/^([A-Za-z]+)-(\d{2}-\d{2})-(\d+)$/, "$1/$2/$3");
      const hyphenVersion = decoded.replace(/^([A-Za-z]+)\/(\d{2}-\d{2})\/(\d+)$/, "$1-$2-$3");

      order = await Order.findOne({
        $or: [
          { invoiceNumber: decoded },
          { orderNumber: decoded },
          { invoiceNumber: slashVersion },
          { orderNumber: slashVersion },
          { invoiceNumber: hyphenVersion },
          { orderNumber: hyphenVersion },
        ],
      }).populate("items.product", "name sku");
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const pdfBuffer = await generateInvoicePDF(order);
    const invoiceNum = (order.invoiceNumber || order.orderNumber || "INV").replace(/[\/\\]/g, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${invoiceNum}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("Public invoice PDF generation error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to generate invoice PDF" });
  }
});

// Apply requireAuth to every internal /api/orders route
router.use(requireAuth);

const statuses = ["PROCESSING", "ADVANCE_RECEIVED", "PACKED", "DISPATCHED", "CANCELLED"];
const isId = (value) => mongoose.isValidObjectId(value);
const positiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const positiveAmount = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const orderError = (res, status, message) => res.status(status).json({ success: false, message });

const getOrder = async (id, res) => {
  if (!isId(id)) {
    orderError(res, 400, "Invalid order id");
    return null;
  }
  const order = await Order.findById(id).populate("items.product", "name sku");
  if (!order) orderError(res, 404, "Order not found");
  return order;
};

// Create order (STAFF & ADMIN)
router.post("/", validateBody(createOrderSchema), async (req, res) => {
  try {
    const { client = {}, items } = req.body;
    const quantities = new Map();
    for (const item of items) {
      const productKey = item.productId || item.product || item.sku;
      if ((!isId(productKey) && typeof productKey !== "string") || !positiveInteger(item.quantity)) {
        return orderError(res, 400, "Each item must contain a valid product id or SKU and positive integer quantity");
      }
      const key = isId(productKey) ? `id:${productKey}` : `sku:${productKey.trim()}`;
      quantities.set(key, (quantities.get(key) || 0) + Number(item.quantity));
    }

    const ids = [...quantities.keys()].filter((key) => key.startsWith("id:")).map((key) => key.slice(3));
    const skus = [...quantities.keys()].filter((key) => key.startsWith("sku:")).map((key) => key.slice(4));
    const products = await Product.find({ $or: [{ _id: { $in: ids } }, { sku: { $in: skus } }] });
    const productMap = new Map(products.flatMap((product) => [[`id:${product.id}`, product], [`sku:${product.sku}`, product]]));
    const missing = [...quantities.keys()].find((key) => !productMap.has(key));
    if (missing) return orderError(res, 400, `Product ${missing.replace(/^(id:|sku:)/, "")} not found`);

    // Stock reservation check: available = onHand - reserved
    const reservedMap = await getReservedStockMap();

    const orderItems = [...quantities.entries()].map(([productId, quantity]) => {
      const product = productMap.get(productId);
      const reserved = reservedMap.get(product._id.toString()) || 0;
      const available = Math.max(0, product.stock - reserved);

      if (quantity > available) {
        throw new Error(
          `${product.name} has only ${available} available for ordering (${product.stock} on hand, ${reserved} reserved by open orders)`
        );
      }
      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity,
        unitPrice: product.sellingPrice,
        hsn: product.hsn || "8205",
        gstPercent: product.gstPercent ?? 18,
      };
    });

    const totalAmount = orderItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    const orderNumber = await getNextSequence("ORD");
    const invoiceNumber = await getNextSequence("INV");

    // Auto-upsert Customer
    const normalizedPhone = client.phone.trim();
    try {
      await Customer.findOneAndUpdate(
        { phone: normalizedPhone },
        {
          $set: {
            name: client.name.trim(),
            address: client.address.trim(),
            gstin: (client.gstin || "").trim(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch (custErr) {
      console.warn("Auto-upsert customer warning:", custErr.message);
    }

    const order = await Order.create({
      orderNumber,
      invoiceNumber,
      client: { ...client, name: client.name.trim(), phone: normalizedPhone, address: client.address.trim() },
      items: orderItems,
      totalAmount,
      advancePercentage: DEFAULT_ADVANCE_PERCENTAGE,
      advanceRequired: Math.round(totalAmount * DEFAULT_ADVANCE_PERCENTAGE) / 100,
      timeline: [
        {
          status: "PROCESSING",
          action: "ORDER_CREATED",
          timestamp: new Date(),
          userId: req.user?._id,
          userName: req.user?.name || "Staff",
          note: "Order placed",
        },
      ],
    });
    return res.status(201).json({ success: true, order });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to create order" });
  }
});

export const calculateOrderDaysPending = (order) => {
  const refDate = order.packedAt || order.createdAt;
  if (!refDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(refDate).getTime()) / (24 * 60 * 60 * 1000)));
};

// View orders (STAFF & ADMIN)
router.get("/", async (req, res) => {
  try {
    const filter = req.query.status && statuses.includes(req.query.status) ? { status: req.query.status } : {};
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    const thresholdDays = Number(process.env.REMINDER_AFTER_DAYS) || 3;

    const formattedOrders = orders.map((order) => {
      const orderObj = order.toObject();
      const daysPending = calculateOrderDaysPending(orderObj);
      const isOverdue = orderObj.status === "PACKED" && orderObj.balanceAmount > 0 && daysPending >= thresholdDays;

      return {
        ...orderObj,
        packedAt: orderObj.packedAt || (orderObj.status === "PACKED" ? orderObj.createdAt : null),
        daysPending,
        isOverdue,
      };
    });

    return res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load orders", error: error.message });
  }
});

// Overdue payments for packed orders (STAFF & ADMIN)
router.get("/overdue-payments", async (req, res) => {
  try {
    const defaultDays = Number(process.env.REMINDER_AFTER_DAYS) || 3;
    const daysParam = req.query.days ? Number(req.query.days) : defaultDays;
    const thresholdDays = Number.isFinite(daysParam) && daysParam >= 0 ? daysParam : defaultDays;

    const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

    const orders = await Order.find({
      status: "PACKED",
      balanceAmount: { $gt: 0 },
      $or: [
        { packedAt: { $lte: cutoffDate } },
        { packedAt: { $exists: false }, createdAt: { $lte: cutoffDate } },
      ],
    }).sort({ packedAt: 1, createdAt: 1 });

    const overdueOrders = orders.map((order) => {
      const daysPending = calculateOrderDaysPending(order);

      return {
        _id: order._id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientName: order.client?.name || "Unknown Client",
        phone: order.client?.phone || "",
        balance: order.balanceAmount,
        total: order.totalAmount,
        daysPending,
        packedAt: order.packedAt || order.createdAt,
        lastReminderAt: order.lastReminderAt || null,
        reminderCount: Array.isArray(order.reminders) ? order.reminders.length : 0,
      };
    });

    return res.json({
      success: true,
      thresholdDays,
      count: overdueOrders.length,
      orders: overdueOrders,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load overdue payments", error: error.message });
  }
});

// View payments history (STAFF & ADMIN)
router.get("/payments/history", async (req, res) => {
  try {
    const payments = await Payment.find().populate("order", "orderNumber client").sort({ createdAt: -1 });
    return res.json(payments);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load payment history", error: error.message });
  }
});

// Get WhatsApp Cloud API configuration status (STAFF & ADMIN)
router.get("/whatsapp/config", (req, res) => {
  res.json({
    configured: isWhatsAppCloudConfigured(),
    template: process.env.WHATSAPP_INVOICE_TEMPLATE || null,
  });
});

// Export GSTR-1 CSV (STAFF & ADMIN)
router.get("/export/gstr1", async (req, res) => {
  try {
    const { from, to } = req.query;
    const query = {};
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const orders = await Order.find(query).populate("items.product").sort({ createdAt: 1 });

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
    };

    const headers = [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Invoice Number",
      "Invoice Date",
      "Invoice Value",
      "Place Of Supply",
      "Reverse Charge",
      "Applicable % of Tax Rate",
      "Invoice Type",
      "E-Commerce GSTIN",
      "Rate (%)",
      "Taxable Value",
      "Cess Amount",
      "HSN",
      "Item Description",
      "Quantity",
      "Unit Price",
    ];

    const rows = [];
    for (const order of orders) {
      const invNum = order.invoiceNumber || order.orderNumber;
      const invDate = new Date(order.createdAt).toISOString().split("T")[0];
      const gstin = order.client?.gstin || "";
      const receiverName = order.client?.name || "";
      const state = "Karnataka";
      const invValue = order.totalAmount;

      for (const item of order.items) {
        const prod = item.product || {};
        const gstRate = prod.gstPercent ?? 18;
        const hsn = prod.hsn || "8504";
        const lineTotal = item.quantity * item.unitPrice;
        const taxableVal = Math.round((lineTotal / (1 + gstRate / 100)) * 100) / 100;

        rows.push([
          escapeCsv(gstin),
          escapeCsv(receiverName),
          escapeCsv(invNum),
          escapeCsv(invDate),
          invValue,
          escapeCsv(state),
          "N",
          "",
          gstin ? "Regular B2B" : "B2C",
          "",
          gstRate,
          taxableVal,
          0,
          escapeCsv(hsn),
          escapeCsv(item.name || prod.name || ""),
          item.quantity,
          item.unitPrice,
        ].join(","));
      }
    }

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const filename = `GSTR1_${from || "all"}_to_${to || "current"}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("GSTR-1 export error:", error);
    return res.status(500).json({ success: false, message: "Failed to export GSTR-1 CSV", error: error.message });
  }
});

// View single order (STAFF & ADMIN)
router.get("/:id", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (order) {
      const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 });
      const orderObj = order.toObject();
      const effectivePackedAt = orderObj.packedAt || (orderObj.status === "PACKED" ? orderObj.updatedAt || orderObj.createdAt : null);
      const daysPending = effectivePackedAt && orderObj.status === "PACKED"
        ? Math.max(0, Math.floor((Date.now() - new Date(effectivePackedAt).getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

      return res.json({
        ...orderObj,
        packedAt: effectivePackedAt,
        daysPending,
        payments,
        reminders: orderObj.reminders || [],
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Unable to load order", error: error.message });
  }
});

// Generate & stream GST Tax Invoice PDF (STAFF & ADMIN)
router.get("/:id/invoice.pdf", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;

    const pdfBuffer = await generateInvoicePDF(order);
    const invoiceNum = (order.invoiceNumber || order.orderNumber).replace(/[\/\\]/g, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${invoiceNum}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to generate invoice PDF" });
  }
});

// Send invoice PDF via WhatsApp Cloud API (STAFF & ADMIN)
router.post("/:id/send-invoice-whatsapp", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;

    if (!isWhatsAppCloudConfigured()) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: "WhatsApp Cloud API credentials are not configured",
      });
    }

    const result = await sendInvoiceViaWhatsAppCloud(order, req.user);

    if (!Array.isArray(order.reminders)) {
      order.reminders = [];
    }
    const reminderEntry = {
      sentAt: new Date(),
      channel: "WHATSAPP",
      note: `WhatsApp Cloud API: Sent tax invoice ${result.filename} (Msg ID: ${result.messageId})`,
      sentBy: req.user?.name || req.user?.email || "Staff",
    };
    order.reminders.push(reminderEntry);
    order.lastReminderAt = reminderEntry.sentAt;
    await order.save();

    return res.json({
      success: true,
      message: "Invoice PDF dispatched successfully via WhatsApp Cloud API",
      messageId: result.messageId,
      recipient: result.recipient,
      reminders: order.reminders,
    });
  } catch (error) {
    console.warn(`[WhatsApp Cloud API]: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to send invoice via WhatsApp Cloud API",
    });
  }
});

// View order payments (STAFF & ADMIN)
router.get("/:id/payments", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;
    return res.json(await Payment.find({ order: order._id }).sort({ createdAt: -1 }));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load payments", error: error.message });
  }
});

// Record payments (STAFF & ADMIN)
router.post("/:id/payments", validateBody(recordPaymentSchema), async (req, res) => {
  try {
    const { amount, method, paymentType, notes } = req.body;
    const normalizedReference = typeof req.body.reference === "string" ? req.body.reference.trim() : "";
    if (!isId(req.params.id)) return orderError(res, 400, "Invalid order id");

    const payment = await runInTransaction(async (session) => {
      const findOpts = session ? { session } : {};
      const order = await Order.findById(req.params.id, null, findOpts);
      if (!order) throw new Error("Order not found");
      if (["DISPATCHED", "CANCELLED"].includes(order.status)) throw new Error("Payments cannot be recorded for this order");
      const paymentAmount = Number(amount);
      if (order.totalPaid + paymentAmount > order.totalAmount) throw new Error("Payment exceeds the order balance");
      const paymentData = {
        order: order._id,
        amount: paymentAmount,
        method,
        paymentType,
        notes,
        userId: req.user._id,
        userName: req.user.name,
      };
      if (normalizedReference) paymentData.reference = normalizedReference;
      const [newPayment] = session
        ? await Payment.create([paymentData], { session })
        : [await Payment.create(paymentData)];
      order.totalPaid += paymentAmount;
      order.advanceAmount = Math.min(order.advanceRequired, order.totalPaid);
      if (order.status === "PROCESSING" && order.totalPaid >= order.advanceRequired) order.status = "ADVANCE_RECEIVED";

      if (!Array.isArray(order.timeline)) order.timeline = [];
      order.timeline.push({
        status: order.status,
        action: "PAYMENT_RECORDED",
        timestamp: new Date(),
        userId: req.user._id,
        userName: req.user.name,
        note: `Payment of ₹${paymentAmount} received via ${method} (${paymentType})`,
      });

      await order.save(findOpts);
      return newPayment;
    });

    return res.status(201).json(payment);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.reference) {
      return orderError(res, 409, "Payment reference already exists");
    }
    return orderError(res, error.message === "Order not found" ? 404 : 400, error.message);
  }
});

// Record payment reminder (STAFF & ADMIN)
router.post("/:id/reminders", async (req, res) => {
  try {
    const { channel = "WHATSAPP", note = "" } = req.body;
    const allowedChannels = ["WHATSAPP", "EMAIL", "CALL", "MANUAL"];
    if (!allowedChannels.includes(channel)) {
      return orderError(res, 400, `Invalid channel. Allowed channels: ${allowedChannels.join(", ")}`);
    }

    const order = await getOrder(req.params.id, res);
    if (!order) return;

    if (order.status !== "PACKED") {
      return orderError(res, 400, "Reminders can only be recorded for PACKED orders");
    }

    if (order.balanceAmount <= 0) {
      return orderError(res, 400, "Order has no pending balance");
    }

    const sentBy = req.user?.name || req.user?.email || "Staff";
    const sentAt = new Date();

    const reminderEntry = {
      sentAt,
      channel,
      note: String(note || "").trim(),
      sentBy,
    };

    if (!Array.isArray(order.reminders)) {
      order.reminders = [];
    }
    order.reminders.push(reminderEntry);
    order.lastReminderAt = sentAt;

    await order.save();

    return res.status(201).json({
      success: true,
      message: "Reminder recorded successfully",
      reminder: reminderEntry,
      lastReminderAt: order.lastReminderAt,
      reminders: order.reminders,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to record reminder", error: error.message });
  }
});

const transition = (from, to, action, validation) => async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;
    if (order.status !== from) return orderError(res, 409, `Order must be ${from} to ${action}`);
    if (validation) {
      const validationMessage = validation(order);
      if (validationMessage) return orderError(res, 400, validationMessage);
    }
    if (to === "PACKED") {
      markOrderPacked(order);
    } else {
      order.status = to;
    }

    if (!Array.isArray(order.timeline)) order.timeline = [];
    order.timeline.push({
      status: to,
      action: `ORDER_${to}`,
      timestamp: new Date(),
      userId: req.user?._id,
      userName: req.user?.name || "Staff",
      note: `Order status updated to ${to}`,
    });

    await order.save();
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: `Failed to ${action}`, error: error.message });
  }
};

// Admin action endpoints
router.patch("/:id/pack", requireRole("ADMIN"), transition("ADVANCE_RECEIVED", "PACKED", "pack order", (order) => (
  order.totalPaid < order.advanceRequired ? `Advance of ${order.advanceRequired} is required before packing` : ""
)));
router.patch("/:id/confirm-payment", requireRole("ADMIN"), transition("PROCESSING", "ADVANCE_RECEIVED", "confirm advance", (order) => (
  order.totalPaid < order.advanceRequired ? `Advance of ${order.advanceRequired} is required` : ""
)));
router.patch("/:id/start-packing", requireRole("ADMIN"), transition("ADVANCE_RECEIVED", "PACKED", "pack order"));
router.patch("/:id/complete-packing", requireRole("ADMIN"), transition("ADVANCE_RECEIVED", "PACKED", "pack order"));
router.patch("/:id/ready", requireRole("ADMIN"), transition("PACKED", "PACKED", "keep order packed"));
router.patch("/:id/ready-for-dispatch", requireRole("ADMIN"), transition("PACKED", "PACKED", "keep order packed"));

// Order cancellation (ADMIN) with optional refund handling
router.patch("/:id/cancel", requireRole("ADMIN"), validateBody(cancelOrderSchema), async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;
    if (["DISPATCHED", "CANCELLED"].includes(order.status)) return orderError(res, 409, "Order cannot be cancelled");

    const { refundOption = "NONE", note = "" } = req.body;

    order.status = "CANCELLED";
    order.cancelledAt = new Date();
    order.cancellationType = refundOption !== "NONE" ? refundOption : null;
    order.cancellationNote = note;

    if (order.totalPaid > 0 && refundOption !== "NONE") {
      await Payment.updateMany({ order: order._id }, { $set: { status: refundOption } });
    }

    if (!Array.isArray(order.timeline)) order.timeline = [];
    order.timeline.push({
      status: "CANCELLED",
      action: "ORDER_CANCELLED",
      timestamp: new Date(),
      userId: req.user?._id,
      userName: req.user?.name || "Admin",
      note: `Order cancelled. Refund option: ${refundOption}${note ? `. Reason: ${note}` : ""}`,
    });

    await order.save();
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel order", error: error.message });
  }
});

// Dispatch order (ADMIN)
router.patch("/:id/dispatch", requireRole("ADMIN"), async (req, res) => {
  try {
    const dispatchedOrder = await runInTransaction(async (session) => {
      const findOpts = session ? { session } : {};
      const order = await Order.findById(req.params.id, null, findOpts);
      if (!order) throw new Error("Order not found");
      if (order.status !== "PACKED") throw new Error("Order must be PACKED to dispatch");
      if (order.paymentStatus !== "FULLY_PAID") throw new Error("Order must be FULLY_PAID to dispatch");
      const quantities = new Map();
      order.items.forEach((item) => quantities.set(item.product.toString(), (quantities.get(item.product.toString()) || 0) + item.quantity));
      for (const [productId, quantity] of quantities) {
        const updateOpts = session ? { session } : {};
        const result = await Product.updateOne(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          updateOpts
        );
        if (result.modifiedCount !== 1) throw new Error("Insufficient stock for dispatch");
        const movementDoc = {
          product: productId,
          type: "DISPATCH",
          quantity,
          orderId: order._id,
          orderNumber: order.orderNumber,
          note: `Order ${order.orderNumber} dispatched to ${order.client?.name || "Customer"}`,
          userId: req.user._id,
          userName: req.user.name,
        };
        if (session) {
          await StockMovement.create([movementDoc], { session });
        } else {
          await StockMovement.create(movementDoc);
        }
      }
      order.status = "DISPATCHED";
      order.dispatchedAt = new Date();

      if (!Array.isArray(order.timeline)) order.timeline = [];
      order.timeline.push({
        status: "DISPATCHED",
        action: "ORDER_DISPATCHED",
        timestamp: new Date(),
        userId: req.user._id,
        userName: req.user.name,
        note: "Order dispatched to customer",
      });

      return await order.save(findOpts);
    });

    return res.json(dispatchedOrder);
  } catch (error) {
    const status = ["Order not found", "Insufficient stock for dispatch"].includes(error.message)
      ? error.message === "Order not found"
        ? 404
        : 409
      : 400;
    return orderError(res, status, error.message);
  }
});

// Process Sales Return (ADMIN)
router.post("/:id/returns", requireRole("ADMIN"), validateBody(salesReturnSchema), async (req, res) => {
  try {
    const { items: returnedItems, note = "" } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return orderError(res, 404, "Order not found");
    if (order.status !== "DISPATCHED") {
      return orderError(res, 400, "Sales returns can only be processed for DISPATCHED orders");
    }

    if (!Array.isArray(order.returns)) order.returns = [];

    // Calculate previously returned quantities per product
    const prevReturnedMap = new Map();
    for (const ret of order.returns) {
      for (const it of ret.items || []) {
        const pId = it.productId?.toString();
        if (pId) {
          prevReturnedMap.set(pId, (prevReturnedMap.get(pId) || 0) + (it.quantity || 0));
        }
      }
    }

    const returnDetails = [];
    let totalRefund = 0;

    for (const item of returnedItems) {
      const orderItem = order.items.find((oi) => oi.product?.toString() === item.productId);
      if (!orderItem) {
        return orderError(res, 400, `Product ID ${item.productId} was not part of this order`);
      }
      const alreadyReturned = prevReturnedMap.get(item.productId) || 0;
      const maxReturnable = orderItem.quantity - alreadyReturned;
      if (item.quantity > maxReturnable) {
        return orderError(
          res,
          400,
          `Cannot return ${item.quantity} units of ${orderItem.name}. Maximum returnable: ${maxReturnable}`
        );
      }

      const itemRefund = item.quantity * orderItem.unitPrice;
      totalRefund += itemRefund;

      returnDetails.push({
        productId: orderItem.product,
        name: orderItem.name,
        sku: orderItem.sku,
        quantity: item.quantity,
        refundAmount: itemRefund,
      });

      // Restock the product
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });

      // Create StockMovement
      await StockMovement.create({
        product: item.productId,
        type: "RETURN",
        quantity: item.quantity,
        userId: req.user._id,
        userName: req.user.name,
        reason: `Sales Return (${order.orderNumber}): ${item.reason || note || "Customer return"}`,
      });
    }

    const creditNoteNumber = await getNextSequence("CN");

    const returnEntry = {
      returnedAt: new Date(),
      creditNoteNumber,
      items: returnDetails,
      totalRefund,
      reason: note || "Customer return",
      handledBy: req.user.name,
    };

    order.returns.push(returnEntry);

    if (!Array.isArray(order.timeline)) order.timeline = [];
    order.timeline.push({
      status: "DISPATCHED",
      action: "SALES_RETURN",
      timestamp: new Date(),
      userId: req.user._id,
      userName: req.user.name,
      note: `Processed sales return ${creditNoteNumber} (Refund value: ₹${totalRefund})`,
    });

    await order.save();

    return res.status(201).json({
      success: true,
      message: `Sales return recorded successfully. Credit Note: ${creditNoteNumber}`,
      creditNoteNumber,
      returnEntry,
      order,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to process sales return", error: error.message });
  }
});

export default router;
