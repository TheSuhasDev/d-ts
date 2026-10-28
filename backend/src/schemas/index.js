import { z } from "zod";

// --- Auth Schemas ---
export const loginSchema = z.object({
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// --- Assistant Schemas ---
export const assistantChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "model", "system"]),
        content: z.string().max(4000, "Message too long"),
      })
    )
    .min(1, "At least one message is required"),
});

export const assistantActionSchema = z.object({
  actionId: z.string().trim().min(1, "actionId is required"),
});

// --- Product Schemas ---
export const receiveStockSchema = z.object({
  quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
  supplier: z.string().trim().optional(),
  poReference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const dispatchStockSchema = z.object({
  quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
});

export const adjustStockSchema = z.object({
  delta: z.coerce.number().int().refine((val) => val !== 0, "Adjustment delta cannot be 0"),
  reason: z.enum(["DAMAGED", "LOST", "FOUND", "CORRECTION", "COUNT", "UNDO_RECEIVE"]).default("CORRECTION"),
  note: z.string().trim().optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  sku: z.string().trim().min(1, "SKU is required"),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be >= 0"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be >= 0"),
  stock: z.coerce.number().int().min(0).default(0),
  minimumStock: z.coerce.number().int().min(0).default(5),
  location: z.string().trim().default("Not Assigned"),
});

export const dispatchTransactionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
      })
    )
    .min(1, "At least one item is required"),
  client: z.object({
    name: z.string().trim().min(1, "Client name is required"),
    phone: z.string().trim().min(1, "Client phone is required"),
    address: z.string().trim().min(1, "Client address is required"),
    gstin: z.string().trim().optional(),
  }),
});

// --- Order Schemas ---
export const createOrderSchema = z.object({
  client: z.object({
    name: z.string().trim().min(1, "Client name is required"),
    phone: z.string().trim().min(1, "Client phone is required"),
    address: z.string().trim().min(1, "Client address is required"),
    gstin: z.string().trim().optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
      })
    )
    .min(1, "At least one item is required"),
  advancePercentage: z.coerce.number().min(0).max(100).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("UPI"),
  paymentType: z.enum(["ADVANCE", "FULL", "PARTIAL"]).default("PARTIAL"),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const cancelOrderSchema = z.object({
  refundOption: z.enum(["REFUNDED", "CREDITED", "NONE"]).default("NONE"),
  note: z.string().trim().optional(),
});

export const salesReturnSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
        reason: z.string().trim().optional(),
      })
    )
    .min(1, "At least one item is required"),
  note: z.string().trim().optional(),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().trim().min(5, "Customer phone is required"),
  address: z.string().trim().min(1, "Address is required"),
  gstin: z.string().trim().optional(),
  state: z.string().trim().optional(),
});
