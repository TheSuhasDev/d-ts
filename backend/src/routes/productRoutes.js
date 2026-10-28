import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import Order from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { runInTransaction } from "../config/database.js";
import { validateBody } from "../middleware/validate.js";
import {
  receiveStockSchema,
  dispatchStockSchema,
  adjustStockSchema,
  createProductSchema,
  dispatchTransactionSchema,
} from "../schemas/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use(requireAuth);

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
};

// Configure Multer for in-memory image upload before sharp processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP images are allowed (max 2MB)"));
    }
  },
});

import {
  getReservedStockMap,
  getReorderSuggestions,
} from "../services/reorderService.js";

export { getReservedStockMap };

// Create product (ADMIN only)
router.post("/", requireRole("ADMIN"), validateBody(createProductSchema), async (req, res) => {
  try {
    const existing = await Product.findOne({ sku: req.body.sku.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: `Product with SKU ${req.body.sku} already exists` });
    }
    const product = await Product.create({
      ...req.body,
      sku: req.body.sku.toUpperCase(),
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to create product", error: error.message });
  }
});

// Get all products with On Hand, Reserved, Available counts (STAFF & ADMIN)
router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const filter = includeInactive ? {} : { isActive: { $ne: false } };

    const [products, reservedMap, suggestions] = await Promise.all([
      Product.find(filter).sort({ name: 1 }),
      getReservedStockMap(),
      getReorderSuggestions({ days: 30 }).catch(() => null),
    ]);

    const suggestionsMap = new Map();
    if (suggestions?.items) {
      for (const item of suggestions.items) {
        const id = String(item.productId || item.product || item._id || "");
        if (id) suggestionsMap.set(id, item);
      }
    }

    const formattedProducts = products.map((product) => {
      const pObj = product.toObject();
      const onHand = Number(pObj.stock) || 0;
      const reserved = reservedMap.get(String(product._id)) || 0;
      const available = Math.max(0, onHand - reserved);
      const sugg = suggestionsMap.get(String(product._id));

      return {
        ...pObj,
        onHand,
        reserved,
        available,
        status: sugg?.status || (available <= (product.minimumStock || 0) ? "LOW" : "OK"),
        reorderPoint: sugg?.reorderPoint ?? product.minimumStock,
        suggestedOrder: sugg?.suggestedOrder ?? 0,
      };
    });

    res.json(formattedProducts);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load products",
      error: error.message,
    });
  }
});

// Update product metadata (ADMIN only)
router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const {
      name,
      purchasePrice,
      sellingPrice,
      minimumStock,
      location,
      leadTimeDays,
      minOrderQty,
      supplier,
      hsn,
      gstPercent,
      isActive,
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (name) product.name = name.trim();
    if (purchasePrice !== undefined) product.purchasePrice = Number(purchasePrice);
    if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice);
    if (minimumStock !== undefined) product.minimumStock = Number(minimumStock);
    if (location) product.location = location.trim();
    if (leadTimeDays !== undefined) product.leadTimeDays = Number(leadTimeDays);
    if (minOrderQty !== undefined) product.minOrderQty = Number(minOrderQty);
    if (supplier) {
      if (typeof supplier === "string") {
        product.supplier = {
          name: supplier.trim(),
          phone: product.supplier?.phone || "+91 98765 00000",
        };
      } else if (typeof supplier === "object") {
        product.supplier = {
          name: supplier.name ? supplier.name.trim() : product.supplier?.name || "Standard Supplier",
          phone: supplier.phone ? supplier.phone.trim() : product.supplier?.phone || "+91 98765 00000",
        };
      }
    }
    if (hsn) product.hsn = hsn.trim();
    if (gstPercent !== undefined) product.gstPercent = Number(gstPercent);
    if (isActive !== undefined) product.isActive = Boolean(isActive);

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update product" });
  }
});

// Toggle product active status (ADMIN only)
router.patch("/:id/toggle-status", requireRole("ADMIN"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      message: `Product ${product.isActive ? "reactivated" : "deactivated"} successfully`,
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle product status", error: error.message });
  }
});

// Soft-delete product (ADMIN only - sets isActive: false)
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.isActive = false;
    await product.save();

    res.json({ message: "Product deactivated (soft-deleted)", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to deactivate product", error: error.message });
  }
});

// Upload and optimize product image with Sharp (ADMIN only)
router.post("/:id/image", requireRole("ADMIN"), upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please provide an image file (JPG, PNG, WebP)" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const uploadsDir = path.join(__dirname, "../../uploads/products");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${product._id}.webp`;
    const outputPath = path.join(uploadsDir, filename);

    // Resize image to max 600x600 WebP format
    await sharp(req.file.buffer)
      .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);

    // Update product imageUrl with cache buster query
    const relativeUrl = `/uploads/products/${filename}?t=${Date.now()}`;
    product.imageUrl = relativeUrl;
    await product.save();

    res.json({
      message: "Product image uploaded and optimized successfully",
      imageUrl: relativeUrl,
      product,
    });
  } catch (error) {
    console.error("Product image upload failed:", error);
    res.status(500).json({ message: error.message || "Failed to process image" });
  }
});

// Remove product image (ADMIN only)
router.delete("/:id/image", requireRole("ADMIN"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const uploadsDir = path.join(__dirname, "../../uploads/products");
    const filename = `${product._id}.webp`;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Failed to delete local image file:", e);
      }
    }

    product.imageUrl = "";
    await product.save();

    res.json({ message: "Product image removed successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove product image", error: error.message });
  }
});

// Dashboard metrics (STAFF & ADMIN)
router.get("/dashboard", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [products, todayDispatchesOrders, todayDispatchesMovements, recentMovements, reorderStats] = await Promise.all([
      Product.find().sort({ name: 1 }),
      Order.countDocuments({
        status: "DISPATCHED",
        $or: [
          { dispatchedAt: { $gte: todayStart } },
          { updatedAt: { $gte: todayStart } },
        ],
      }),
      StockMovement.countDocuments({
        type: "DISPATCH",
        createdAt: { $gte: todayStart },
      }),
      StockMovement.find()
        .populate("product", "name sku")
        .sort({ createdAt: -1 })
        .limit(8),
      getReorderSuggestions({ days: 30 }),
    ]);

    const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    // Single source of truth: items flagged CRITICAL or WARNING in reorderService
    const lowStockCount = reorderStats.criticalCount + reorderStats.warningCount;
    const inventoryValue = products.reduce((acc, p) => acc + (p.stock || 0) * (p.sellingPrice || 0), 0);
    const todayDispatches = Math.max(todayDispatchesOrders, todayDispatchesMovements);

    res.json({
      totalProducts: products.length,
      productsCount: products.length,
      totalStock,
      lowStockProducts: lowStockCount,
      lowStockCount,
      criticalStockCount: reorderStats.criticalCount,
      warningStockCount: reorderStats.warningCount,
      inventoryValue,
      todayDispatchCount: todayDispatches,
      todayDispatches,
      recentMovements,
    });
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    res.status(500).json({ message: "Unable to load dashboard data" });
  }
});

// Smart Reorder Suggestions with Lead Time, Min Batch, Available Stock, & Transparent "Why" Text
router.get("/reorder-suggestions", async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10);
    const coverDays = parseInt(req.query.coverDays, 10);
    const result = await getReorderSuggestions({ days, coverDays });

    res.json({
      days: result.windowDays,
      coverDays: result.coverDays,
      criticalCount: result.criticalCount,
      warningCount: result.warningCount,
      totalCount: result.items.length,
      generatedAt: new Date().toISOString(),
      items: result.items,
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to calculate reorder suggestions",
      error: error.message,
    });
  }
});

// Receive stock (STAFF & ADMIN)
router.patch("/:id/receive", requireRole("STAFF", "ADMIN"), validateBody(receiveStockSchema), async (req, res) => {
  try {
    const { quantity, supplier, poReference, note } = req.body;
    const parsedQuantity = parseQuantity(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    const productBefore = await Product.findById(req.params.id);
    if (!productBefore) {
      return res.status(404).json({ message: "Product not found" });
    }

    const beforeStock = productBefore.stock;
    productBefore.stock += parsedQuantity;
    await productBefore.save();

    await StockMovement.create({
      product: productBefore._id,
      type: "RECEIVE",
      quantity: parsedQuantity,
      userId: req.user._id,
      userName: req.user.name,
      supplier: supplier || productBefore.supplier?.name || undefined,
      poReference: poReference || undefined,
      note: note || (poReference ? `PO: ${poReference}` : (supplier ? `Supplier: ${supplier}` : undefined)),
      beforeStock,
      afterStock: productBefore.stock,
    });

    res.json({
      message: "Stock received successfully",
      product: productBefore,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to receive stock", error: error.message });
  }
});

// Undo Receive (compensating ADJUSTMENT movement)
router.post("/:id/undo-receive", requireRole("STAFF", "ADMIN"), validateBody(receiveStockSchema), async (req, res) => {
  try {
    const { quantity } = req.body;
    const parsedQuantity = parseQuantity(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, stock: { $gte: parsedQuantity } },
      { $inc: { stock: -parsedQuantity } },
      { returnDocument: "after" }
    );

    if (!product) {
      return res.status(400).json({ message: "Cannot undo receive: insufficient stock or product not found" });
    }

    await StockMovement.create({
      product: product._id,
      type: "ADJUSTMENT",
      quantity: parsedQuantity,
      reason: "UNDO_RECEIVE",
      note: "Compensating adjustment: 5-second scanner receive undone by user",
      userId: req.user._id,
      userName: req.user.name,
      afterStock: product.stock,
    });

    res.json({
      message: "Receive undone successfully with compensating adjustment",
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to undo receive", error: error.message });
  }
});

// Manual Stock Adjustment with Mandatory Reason & Note (ADMIN only)
router.post("/:id/adjust", requireRole("ADMIN"), validateBody(adjustStockSchema), async (req, res) => {
  try {
    const { delta, reason, note } = req.body;
    const productBefore = await Product.findById(req.params.id);
    if (!productBefore) {
      return res.status(404).json({ message: "Product not found" });
    }

    const beforeStock = productBefore.stock;
    const newStock = beforeStock + delta;
    if (newStock < 0) {
      return res.status(400).json({
        message: `Adjustment of ${delta} exceeds current stock (${beforeStock})`,
      });
    }

    productBefore.stock = newStock;
    await productBefore.save();

    await StockMovement.create({
      product: productBefore._id,
      type: "ADJUSTMENT",
      quantity: Math.abs(delta),
      reason,
      note: note || `Manual adjustment by admin (${delta > 0 ? "+" : ""}${delta})`,
      userId: req.user._id,
      userName: req.user.name,
      beforeStock,
      afterStock: newStock,
    });

    res.json({
      message: "Stock adjusted successfully",
      product: productBefore,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to adjust stock", error: error.message });
  }
});

// View all stock movements with audit user (STAFF & ADMIN)
router.get(["/movements", "/movements/history"], async (req, res) => {
  try {
    const movements = await StockMovement.find()
      .populate("product", "name sku")
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(movements);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load stock history",
      error: error.message,
    });
  }
});

// Dispatch stock (ADMIN only)
router.patch("/:id/dispatch", requireRole("ADMIN"), validateBody(dispatchStockSchema), async (req, res) => {
  try {
    const { quantity } = req.body;
    const parsedQuantity = parseQuantity(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, stock: { $gte: parsedQuantity } },
      { $inc: { stock: -parsedQuantity } },
      { returnDocument: "after" }
    );

    if (!product) {
      return res.status(400).json({ message: "Insufficient stock or product not found" });
    }

    await StockMovement.create({
      product: product._id,
      type: "DISPATCH",
      quantity: parsedQuantity,
      userId: req.user._id,
      userName: req.user.name,
      afterStock: product.stock,
    });

    res.json({
      message: "Stock dispatched successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to dispatch stock", error: error.message });
  }
});

// Direct stock dispatch transaction (ADMIN only)
router.post("/dispatch/transaction", requireRole("ADMIN"), validateBody(dispatchTransactionSchema), async (req, res) => {
  const items = req.body.items || [];

  try {
    const updatedProducts = await runInTransaction(async (session) => {
      const results = [];
      for (const item of items) {
        const quantity = parseQuantity(item.quantity);
        if (!quantity) throw new Error("Every dispatch quantity must be a positive integer");

        const updateOptions = { returnDocument: "after" };
        if (session) updateOptions.session = session;

        const product = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          updateOptions
        );
        if (!product) throw new Error("A product is missing or has insufficient stock");

        const movementDoc = {
          product: product._id,
          type: "DISPATCH",
          quantity,
          userId: req.user._id,
          userName: req.user.name,
          afterStock: product.stock,
        };

        if (session) {
          await StockMovement.create([movementDoc], { session });
        } else {
          await StockMovement.create(movementDoc);
        }

        results.push({ product, quantity });
      }
      return results;
    });

    res.json({ message: "Dispatch completed successfully", products: updatedProducts });
  } catch (error) {
    const message = error.message || "";
    res.status(
      message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("missing")
        ? 400
        : 500
    ).json({ message: error.message || "Dispatch failed" });
  }
});

export default router;