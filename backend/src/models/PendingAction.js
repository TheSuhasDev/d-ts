import mongoose from "mongoose";

const pendingActionSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    tool: {
      type: String,
      required: true,
      default: "recordPayment",
    },
    args: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // 5 minutes TTL in MongoDB
    },
  },
  {
    timestamps: false,
  }
);

const PendingAction = mongoose.model("PendingAction", pendingActionSchema);

export default PendingAction;
