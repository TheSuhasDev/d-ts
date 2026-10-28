import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    minimumStock: {
      type: Number,
      default: 5,
      min: 0,
    },

    location: {
      type: String,
      default: "Not Assigned",
      trim: true,
    },

    leadTimeDays: {
      type: Number,
      default: 3,
      min: 0,
    },

    minOrderQty: {
      type: Number,
      default: 5,
      min: 1,
    },

    supplier: {
      name: { type: String, default: "Standard Tool Supplies", trim: true },
      phone: { type: String, default: "+91 98765 00000", trim: true },
    },

    hsn: {
      type: String,
      default: "8205",
      trim: true,
    },

    gstPercent: {
      type: Number,
      default: 18,
      min: 0,
      max: 28,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    imageUrl: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;