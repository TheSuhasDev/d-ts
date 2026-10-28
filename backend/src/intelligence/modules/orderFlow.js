import Order from "../../models/Order.js";

/**
 * Order Flow & Payment Bottleneck Detection:
 * 1. Stuck orders:
 *    - PROCESSING > 2 days -> WARNING
 *    - ADVANCE_RECEIVED not packed > 2 days -> WARNING
 *    - PACKED not dispatched > 3 days -> WARNING
 * 2. Payment Ladder for PACKED orders with balance > 0:
 *    - Day 3: Gentle reminder (INFO)
 *    - Day 7: Firm reminder (WARNING)
 *    - Day 14: Overdue escalation (CRITICAL)
 *    - Skips if reminder was logged in the last 48 hours.
 */
export async function runOrderFlow() {
  const now = new Date();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  const orders = await Order.find({
    status: { $in: ["PROCESSING", "ADVANCE_RECEIVED", "PACKED"] },
  }).lean();

  const insights = [];

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    const orderAgeDays = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

    // 1. Stuck Order Detection
    if (order.status === "PROCESSING" && orderAgeDays >= 2) {
      insights.push({
        type: "ORDER_FLOW",
        severity: "WARNING",
        title: `Stuck in Processing: Order ${order.orderNumber}`,
        message: `Order ${order.orderNumber} for ${order.client.name} has been awaiting advance payment confirmation for ${orderAgeDays} days.`,
        why: `Created on ${createdAt.toISOString().slice(0, 10)} (${orderAgeDays} days elapsed, threshold: 2 days). Advance required: ₹${(order.advanceRequired || 0).toLocaleString("en-IN")}.`,
        entityType: "ORDER",
        entityId: order._id.toString(),
        dedupeKey: `stuck_processing_${order._id}`,
        metadata: { orderNumber: order.orderNumber, status: order.status, elapsedDays: orderAgeDays },
      });
    } else if (order.status === "ADVANCE_RECEIVED") {
      const statusDate = order.updatedAt ? new Date(order.updatedAt) : createdAt;
      const daysSinceAdvance = Math.floor((now.getTime() - statusDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceAdvance >= 2) {
        insights.push({
          type: "ORDER_FLOW",
          severity: "WARNING",
          title: `Packing Delayed: Order ${order.orderNumber}`,
          message: `Advance payment has been confirmed for ${order.orderNumber}, but packing has been pending for ${daysSinceAdvance} days.`,
          why: `Advance confirmed ${daysSinceAdvance} days ago (threshold: 2 days). Packing team attention required.`,
          entityType: "ORDER",
          entityId: order._id.toString(),
          dedupeKey: `stuck_advance_${order._id}`,
          metadata: { orderNumber: order.orderNumber, status: order.status, elapsedDays: daysSinceAdvance },
        });
      }
    } else if (order.status === "PACKED") {
      const packedDate = order.packedAt ? new Date(order.packedAt) : new Date(order.updatedAt || createdAt);
      const daysSincePacked = Math.floor((now.getTime() - packedDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSincePacked >= 3) {
        insights.push({
          type: "ORDER_FLOW",
          severity: "WARNING",
          title: `Dispatch Delayed: Order ${order.orderNumber}`,
          message: `Order ${order.orderNumber} was packed ${daysSincePacked} days ago but has not been dispatched.`,
          why: `Packed on ${packedDate.toISOString().slice(0, 10)} (${daysSincePacked} days elapsed, threshold: 3 days). Ready for vehicle loading.`,
          entityType: "ORDER",
          entityId: order._id.toString(),
          dedupeKey: `stuck_dispatch_${order._id}`,
          metadata: { orderNumber: order.orderNumber, status: order.status, elapsedDays: daysSincePacked },
        });
      }

      // 2. Payment Ladder for PACKED orders with balance
      const balance = order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, order.totalAmount - (order.totalPaid || 0));
      if (balance > 0) {
        // Check if reminder was sent in the last 48 hours
        const lastReminder = order.lastReminderAt
          ? new Date(order.lastReminderAt)
          : order.reminders?.length
          ? new Date(order.reminders[order.reminders.length - 1].sentAt)
          : null;

        const reminderWithin48h = lastReminder && now.getTime() - lastReminder.getTime() < fortyEightHoursMs;

        if (!reminderWithin48h) {
          if (daysSincePacked >= 14) {
            insights.push({
              type: "ORDER_FLOW",
              severity: "CRITICAL",
              title: `Critical Payment Overdue: Order ${order.orderNumber}`,
              message: `Order ${order.orderNumber} for ${order.client.name} has had an unpaid balance of ₹${balance.toLocaleString("en-IN")} for ${daysSincePacked} days.`,
              why: `Balance ₹${balance.toLocaleString("en-IN")} unpaid for ${daysSincePacked} days since packing on ${packedDate.toISOString().slice(0, 10)} (>= 14 day escalation threshold). No reminder in 48h.`,
              entityType: "ORDER",
              entityId: order._id.toString(),
              dedupeKey: `payment_ladder_14_${order._id}`,
              metadata: { orderNumber: order.orderNumber, balance, daysSincePacked, level: "CRITICAL_ESCALATION" },
            });
          } else if (daysSincePacked >= 7) {
            insights.push({
              type: "ORDER_FLOW",
              severity: "WARNING",
              title: `Firm Payment Reminder Due: Order ${order.orderNumber}`,
              message: `Order ${order.orderNumber} balance of ₹${balance.toLocaleString("en-IN")} is ${daysSincePacked} days overdue. Firm reminder recommended.`,
              why: `Packed ${daysSincePacked} days ago (>= 7 days). Outstanding balance: ₹${balance.toLocaleString("en-IN")}. Last reminder was >48h ago or never sent.`,
              entityType: "ORDER",
              entityId: order._id.toString(),
              dedupeKey: `payment_ladder_7_${order._id}`,
              metadata: { orderNumber: order.orderNumber, balance, daysSincePacked, level: "FIRM_REMINDER" },
            });
          } else if (daysSincePacked >= 3) {
            insights.push({
              type: "ORDER_FLOW",
              severity: "INFO",
              title: `Gentle Payment Reminder Suggested: Order ${order.orderNumber}`,
              message: `Order ${order.orderNumber} packed ${daysSincePacked} days ago. Balance of ₹${balance.toLocaleString("en-IN")} pending.`,
              why: `Packed ${daysSincePacked} days ago (>= 3 days). Pending balance: ₹${balance.toLocaleString("en-IN")}. WhatsApp gentle reminder suggested.`,
              entityType: "ORDER",
              entityId: order._id.toString(),
              dedupeKey: `payment_ladder_3_${order._id}`,
              metadata: { orderNumber: order.orderNumber, balance, daysSincePacked, level: "GENTLE_REMINDER" },
            });
          }
        }
      }
    }
  }

  return insights;
}
