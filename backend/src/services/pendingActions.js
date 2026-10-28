import crypto from "crypto";
import PendingAction from "../models/PendingAction.js";

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates and stores a pending action in MongoDB with a 5-minute TTL index
 */
export const createPendingAction = async ({
  userId,
  tool,
  args,
  summary,
  metadata = {},
}) => {
  const actionId = `act_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const doc = await PendingAction.create({
    actionId,
    userId,
    orderId: args?.orderId,
    tool,
    args,
    summary,
    metadata,
    status: "PENDING",
    createdAt: new Date(),
  });

  return {
    id: doc.actionId,
    userId: String(doc.userId),
    orderId: String(doc.orderId),
    tool: doc.tool,
    args: doc.args,
    summary: doc.summary,
    metadata: doc.metadata,
    status: doc.status,
    expiresAt: new Date(doc.createdAt.getTime() + EXPIRY_MS).toISOString(),
  };
};

/**
 * Retrieves a valid, non-expired pending action by actionId
 */
export const getPendingAction = async (actionId) => {
  if (!actionId) return null;
  const doc = await PendingAction.findOne({ actionId, status: "PENDING" });
  if (!doc) return null;

  return {
    id: doc.actionId,
    userId: String(doc.userId),
    orderId: String(doc.orderId),
    tool: doc.tool,
    args: doc.args,
    summary: doc.summary,
    metadata: doc.metadata,
    status: doc.status,
    expiresAt: new Date(doc.createdAt.getTime() + EXPIRY_MS).toISOString(),
  };
};

/**
 * Discards/cancels a pending action
 */
export const removePendingAction = async (actionId) => {
  if (!actionId) return null;
  return await PendingAction.findOneAndUpdate(
    { actionId, status: "PENDING" },
    { status: "CANCELLED" },
    { returnDocument: "after" }
  );
};

/**
 * Atomically marks a pending action as CONFIRMED (guaranteeing idempotency)
 */
export const markActionConfirmed = async (actionId, userId) => {
  if (!actionId) return null;
  return await PendingAction.findOneAndUpdate(
    { actionId, userId, status: "PENDING" },
    { status: "CONFIRMED" },
    { returnDocument: "after" }
  );
};
