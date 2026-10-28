import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    type: {
      type: String,
      enum: ["RECEIVE", "DISPATCH", "ADJUSTMENT", "RETURN"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    reason: {
      type: String,
      trim: true,
    },

    note: {
      type: String,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    userName: {
      type: String,
      trim: true,
    },

    beforeStock: {
      type: Number,
    },

    afterStock: {
      type: Number,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    orderNumber: {
      type: String,
      trim: true,
      index: true,
    },

    supplier: {
      type: String,
      trim: true,
    },

    poReference: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const StockMovement = mongoose.model(
  "StockMovement",
  stockMovementSchema
);

export default StockMovement;