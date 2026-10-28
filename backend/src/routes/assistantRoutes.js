import express from "express";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { generate } from "../services/llm.js";
import { getToolsForUser, executeTool } from "../services/assistantTools.js";
import {
  getPendingAction,
  removePendingAction,
  markActionConfirmed,
} from "../services/pendingActions.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import Insight from "../models/Insight.js";
import { runInTransaction } from "../config/database.js";
import { validateBody } from "../middleware/validate.js";
import { assistantChatSchema, assistantActionSchema } from "../schemas/index.js";
import { getReorderSuggestions as fetchSmartReorder } from "../services/reorderService.js";

const router = express.Router();

// All assistant routes require authentication
router.use(requireAuth);

const userRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 25; // 25 requests per minute

const checkRateLimit = (userId) => {
  const now = Date.now();
  const entry = userRateLimits.get(userId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    userRateLimits.set(userId, entry);
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  userRateLimits.set(userId, entry);
  return true;
};

const SYSTEM_PROMPT = `You are an intelligent, concise, and friendly AI Warehouse Assistant for Denika & Team Solutions.
Your role is to help warehouse staff and administrators monitor inventory, check order fulfillment, inspect payment statuses, review reorder suggestions, explain decentralized warehouse insights, and record payments (for administrators).

Strict Operating Guidelines:
1. Grounding: Answer strictly using facts returned from your tool results. Never invent product names, stock quantities, statistical numbers, baselines, or financial details.
2. Intelligence & Insights: When explaining warehouse insights (demand spikes, slow stock, stock integrity, stuck orders, or customer credit risk), always explain using the factual metrics from the 'why' field.
3. Clarification: If a user's query is ambiguous (e.g. "order 12" when multiple exist or "drill" when multiple SKUs match), ask a brief clarifying question or list the matches.
4. Currency: Always format Indian Rupees as ₹ (e.g., ₹2,500).
5. Tone & Brevity: Keep answers concise, actionable, and friendly. Avoid fluffy filler. Use clean bullet points for lists.
6. Actions & Security: You can view live warehouse data anytime. You can record payments ONLY when requested by an administrator; when you initiate a payment, explain that a confirmation card has been generated and the payment will only take effect once they click Confirm.
7. Reorder Suggestions: When asked what to reorder, replenish, or what items are low, ALWAYS call the 'getReorderSuggestions' tool. Report the items that have CRITICAL or WARNING urgency, detailing their available stock (on hand minus active order reservations), daily burn rate, and recommended replenishment quantity rounded to supplier MOQ batch.`;

/**
 * Small rule-based fallback answering reorder suggestions, low stock, overdue payments, and order status directly from DB
 */
const handleSmallRuleBasedFallback = async (queryText) => {
  const text = String(queryText || "").toLowerCase().trim();

  // 1. Reorder & Low stock
  if (
    text.includes("reorder") ||
    text.includes("low stock") ||
    text.includes("out of stock") ||
    text.includes("stock low") ||
    text.includes("shortage") ||
    text.includes("replenish") ||
    text.includes("stock level")
  ) {
    const reorderData = await fetchSmartReorder({ days: 30 });
    const needed = reorderData.reorderNeededItems;

    if (!needed.length) {
      return "Based on 30-day predictive burn-rate telemetry and safety stock levels, no items currently require replenishment. All inventory levels are healthy.";
    }

    const lines = needed.map((item) => {
      const badge = item.urgency === "CRITICAL" ? "🔴 **CRITICAL**" : "🟡 **WARNING**";
      const daysStr = item.daysLeft !== null ? `~${item.daysLeft} days left` : "Runout imminent";
      return `• ${badge} **${item.name}** (${item.sku}): **${item.available} available** (${item.onHand} on hand, ${item.reserved} reserved). Suggested order: **${item.suggestedReorder} units** (${daysStr}).\n  *Why:* ${item.reason}`;
    });

    return `📦 **[Smart Reorder Telemetry Analysis]:**\n${lines.join("\n\n")}`;
  }

  // 2. Overdue payments
  if (
    text.includes("overdue") ||
    text.includes("unpaid") ||
    text.includes("payment") ||
    text.includes("balance") ||
    text.includes("debt")
  ) {
    const thresholdDays = Number(process.env.REMINDER_AFTER_DAYS) || 3;
    const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    const overdueOrders = await Order.find({
      status: "PACKED",
      balanceAmount: { $gt: 0 },
      $or: [
        { packedAt: { $lte: cutoffDate } },
        { packedAt: { $exists: false }, updatedAt: { $lte: cutoffDate } },
      ],
    })
      .sort({ packedAt: 1, createdAt: 1 })
      .limit(8);

    if (!overdueOrders.length) {
      return "Great news: There are no overdue payments (>3 days packed) currently pending customer recovery.";
    }

    const lines = overdueOrders.map(
      (o) =>
        `• **Order #${o.orderNumber}** (${o.client?.name}): Pending balance **₹${o.balanceAmount?.toLocaleString(
          "en-IN"
        )}** (Phone: ${o.client?.phone || "—"})`
    );
    return `⚠️ **[Live Database Fallback] Overdue Payments (> ${thresholdDays} days packed):**\n${lines.join("\n")}`;
  }

  // 3. Order status
  if (text.includes("order") || text.includes("ord-") || text.includes("ord/")) {
    const match = text.match(/ord[-/][a-z0-9-]+/i);
    let filter = {};
    if (match) {
      filter = { orderNumber: { $regex: new RegExp(match[0], "i") } };
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(5);

    if (!orders.length) {
      return "No matching orders found in the database.";
    }

    const lines = orders.map(
      (o) =>
        `• **Order #${o.orderNumber}** (${o.client?.name}) — Status: **${o.status}**, Paid: ₹${o.totalPaid?.toLocaleString(
          "en-IN"
        )} of ₹${o.totalAmount?.toLocaleString("en-IN")}`
    );
    return `⚠️ **[Live Database Fallback] Order Status:**\n${lines.join("\n")}`;
  }

  // 4. What needs attention today / intelligence alerts
  if (
    text.includes("attention") ||
    text.includes("insight") ||
    text.includes("alert") ||
    text.includes("issue") ||
    text.includes("warning") ||
    text.includes("critical")
  ) {
    const insights = await Insight.find({
      status: { $in: ["OPEN", "ACKED"] },
      severity: { $in: ["CRITICAL", "WARNING"] },
    })
      .sort({ severity: 1, createdAt: -1 })
      .limit(6);

    if (!insights.length) {
      return "All decentralized intelligence indicators are currently nominal. No active critical bottlenecks or warnings detected!";
    }

    const lines = insights.map(
      (i) =>
        `• **[${i.severity}] ${i.title}**: ${i.message}\n  *Why*: ${i.why}`
    );
    return `⚡ **[Decentralized Intelligence Insights - What Needs Attention Today]:**\n\n${lines.join("\n\n")}`;
  }

  return null;
};

// POST /api/assistant/chat
router.post("/chat", validateBody(assistantChatSchema), async (req, res) => {
  const userId = String(req.user._id);
  if (!checkRateLimit(userId)) {
    return res.status(429).json({
      success: false,
      message: "You have exceeded the chat rate limit (max 25 requests/min). Please wait a moment.",
    });
  }

  const { messages } = req.body;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Trim history to last 10 messages & cap length of each message to 1000 characters
  const trimmedMessages = messages.slice(-10).map((m) => ({
    role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 1000),
  }));

  const tools = getToolsForUser(req.user.role);
  let workingMessages = [...trimmedMessages];
  let pendingAction = null;
  let finalReply = "";
  let rounds = 0;
  const MAX_ROUNDS = 5;

  try {
    while (rounds < MAX_ROUNDS) {
      rounds += 1;
      const llmResult = await generate({
        systemPrompt: SYSTEM_PROMPT,
        messages: workingMessages,
        tools,
      });

      const functionCalls = llmResult.functionCalls || [];

      if (!functionCalls.length) {
        finalReply = llmResult.text;
        break;
      }

      workingMessages.push({
        role: "assistant",
        content: llmResult.text || "",
        functionCalls,
        rawContent: llmResult.rawContent,
      });

      const toolResponses = [];
      for (const call of functionCalls) {
        let toolOutput;
        try {
          toolOutput = await executeTool(call.name, call.args, req.user);
          if (toolOutput?.status === "PENDING_CONFIRMATION" && toolOutput.pendingActionId) {
            const stagedAction = await getPendingAction(toolOutput.pendingActionId);
            if (stagedAction) {
              pendingAction = stagedAction;
            }
          }
        } catch (err) {
          toolOutput = { error: `Failed to execute ${call.name}: ${err.message}` };
        }

        toolResponses.push({
          name: call.name,
          output: toolOutput,
        });
      }

      workingMessages.push({
        role: "tool_response",
        toolResponses,
      });
    }

    if (!finalReply) {
      finalReply = "I have processed your request. Please review the details.";
    }

    return res.json({
      success: true,
      reply: finalReply,
      pendingAction: pendingAction
        ? {
            id: pendingAction.id,
            tool: pendingAction.tool,
            summary: pendingAction.summary,
            expiresAt: pendingAction.expiresAt,
          }
        : null,
    });
  } catch (error) {
    // If every model fails, attempt small rule-based DB fallback for low stock, overdue payments, and order status
    try {
      const fallbackAnswer = await handleSmallRuleBasedFallback(lastUserMsg);
      if (fallbackAnswer) {
        return res.json({
          success: true,
          reply: fallbackAnswer,
          isOfflineFallback: true,
        });
      }
    } catch (fallbackErr) {
      console.error("[Assistant Fallback Error]:", fallbackErr);
    }

    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message:
        error.message ||
        "The AI assistant is temporarily unavailable. You can still ask for 'low stock', 'overdue payments', or 'order status' directly.",
    });
  }
});

// POST /api/assistant/confirm (ADMIN only & idempotent)
router.post(
  "/confirm",
  requireRole("ADMIN"),
  validateBody(assistantActionSchema),
  async (req, res) => {
    const { actionId } = req.body;

    // Atomically transition status from PENDING to CONFIRMED (guarantees idempotency)
    const action = await markActionConfirmed(actionId, req.user._id);

    if (!action) {
      const existing = await getPendingAction(actionId);
      if (!existing) {
        return res.status(400).json({
          success: false,
          message: "Action has already been executed, expired (5-minute limit), or does not exist.",
        });
      }
      if (existing.userId !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: A pending action can only be confirmed by the user who initiated it.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Action could not be confirmed.",
      });
    }

    if (action.tool === "recordPayment") {
      try {
        const createdPayment = await runInTransaction(async (session) => {
          const findOpts = session ? { session } : {};
          const order = await Order.findById(action.args.orderId, null, findOpts);
          if (!order) throw new Error("Order not found");
          if (["DISPATCHED", "CANCELLED"].includes(order.status)) {
            throw new Error(`Payments cannot be recorded for ${order.status} orders.`);
          }

          const paymentAmount = Number(action.args.amount);
          if (order.totalPaid + paymentAmount > order.totalAmount) {
            throw new Error("Payment exceeds remaining order balance.");
          }

          const paymentData = {
            order: order._id,
            amount: paymentAmount,
            method: action.args.method || "UPI",
            paymentType: action.args.type || "PARTIAL",
            notes: action.args.notes || "Recorded via AI Assistant",
          };

          const [payment] = session
            ? await Payment.create([paymentData], { session })
            : [await Payment.create(paymentData)];

          order.totalPaid += paymentAmount;
          order.advanceAmount = Math.min(order.advanceRequired, order.totalPaid);
          if (order.status === "PROCESSING" && order.totalPaid >= order.advanceRequired) {
            order.status = "ADVANCE_RECEIVED";
          }
          await order.save(findOpts);
          return payment;
        });

        return res.json({
          success: true,
          message: `Payment of ₹${action.args.amount.toLocaleString(
            "en-IN"
          )} recorded successfully for Order #${action.metadata?.orderNumber || ""}.`,
          payment: createdPayment,
        });
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    return res.status(400).json({ success: false, message: "Unknown action tool." });
  }
);

// POST /api/assistant/cancel
router.post("/cancel", validateBody(assistantActionSchema), async (req, res) => {
  const { actionId } = req.body;

  const action = await getPendingAction(actionId);
  if (!action) {
    return res.status(400).json({
      success: false,
      message: "Action has already expired, been executed, or does not exist.",
    });
  }

  if (action.userId !== String(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized: A pending action can only be cancelled by the user who created it.",
    });
  }

  await removePendingAction(actionId);
  return res.json({ success: true, message: "Pending action was cancelled." });
});

export default router;
