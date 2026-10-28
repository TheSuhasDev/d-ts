import mongoose from "mongoose";

const insightSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["INFO", "WARNING", "CRITICAL"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    why: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ["PRODUCT", "ORDER", "CUSTOMER"],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "ACKED", "RESOLVED"],
      default: "OPEN",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resolvedAt: {
      type: Date,
    },
    ackedAt: {
      type: Date,
    },
    ackedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

insightSchema.index({ status: 1, severity: 1, createdAt: -1 });

const Insight = mongoose.model("Insight", insightSchema);

export default Insight;
