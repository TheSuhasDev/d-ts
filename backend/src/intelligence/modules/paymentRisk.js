import Customer from "../../models/Customer.js";
import Order from "../../models/Order.js";

/**
 * Calculates a customer's credit and payment risk score (0 - 100).
 * Factoring:
 * - Total outstanding balance (0 - 40 pts)
 * - Average days to pay or overdue duration (0 - 35 pts)
 * - Unpaid/late orders count (0 - 25 pts)
 * Returns { score, tier: 'LOW'|'MEDIUM'|'HIGH', suggestedAdvancePercent, stats }
 */
export async function calculateCustomerRisk(customerIdentifier) {
  let customer = null;
  if (typeof customerIdentifier === "string" && customerIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
    customer = await Customer.findById(customerIdentifier).lean();
  } else if (typeof customerIdentifier === "string") {
    const cleanPhone = customerIdentifier.replace(/[^0-9]/g, "");
    const phoneDigits = cleanPhone.slice(-10);
    const pattern = phoneDigits.length >= 7 ? new RegExp(phoneDigits.split("").join("[\\s\\-\\.]*") + "$") : null;
    customer = await Customer.findOne({
      $or: [
        ...(pattern ? [{ phone: pattern }] : []),
        { name: new RegExp(`^${customerIdentifier.trim()}$`, "i") },
      ],
    }).lean();
  }

  const phoneQuery = customer ? customer.phone : customerIdentifier;
  const cleanPhone = String(phoneQuery).replace(/[^0-9]/g, "");
  const phoneDigits = cleanPhone.slice(-10);
  const phonePattern = phoneDigits.length >= 7
    ? new RegExp(phoneDigits.split("").join("[\\s\\-\\.]*") + "$")
    : null;

  const matchConditions = [];
  if (phonePattern) {
    matchConditions.push({ "client.phone": phonePattern });
  }
  if (customer?.name) {
    matchConditions.push({ "client.name": new RegExp(`^${customer.name.trim()}$`, "i") });
  }

  const orders = await Order.find({
    ...(matchConditions.length > 0 ? { $or: matchConditions } : { "client.phone": cleanPhone }),
    status: { $ne: "CANCELLED" },
  }).lean();

  if (orders.length === 0) {
    return {
      score: 15,
      tier: "LOW",
      suggestedAdvancePercent: 30,
      outstandingBalance: 0,
      unpaidOrdersCount: 0,
      avgDaysToPay: 0,
      totalOrders: 0,
      why: "New customer with zero past orders. Standard 30% advance recommended.",
    };
  }

  let totalBalance = 0;
  let unpaidCount = 0;
  let totalDays = 0;
  let ordersCountedForDays = 0;
  const now = new Date();

  for (const o of orders) {
    const balance = o.balanceAmount !== undefined ? o.balanceAmount : Math.max(0, o.totalAmount - (o.totalPaid || 0));
    if (balance > 0) {
      totalBalance += balance;
      unpaidCount++;
      const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
      totalDays += ageDays;
      ordersCountedForDays++;
    } else {
      // Completed order
      const completedDays = Math.max(
        0,
        Math.floor((new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / (24 * 60 * 60 * 1000))
      );
      totalDays += completedDays;
      ordersCountedForDays++;
    }
  }

  const avgDaysToPay = ordersCountedForDays > 0 ? totalDays / ordersCountedForDays : 0;

  // 1. Balance score (0 - 40 pts, capped at 50,000 INR)
  const balancePts = Math.min(40, (totalBalance / 50000) * 40);

  // 2. Days score (0 - 35 pts, scaled against 30 days)
  const daysPts = Math.min(35, (avgDaysToPay / 30) * 35);

  // 3. Unpaid count score (0 - 25 pts)
  const countPts = Math.min(25, unpaidCount * 8.33);

  const score = Math.min(100, Math.max(0, Math.round(balancePts + daysPts + countPts)));

  let tier = "LOW";
  let suggestedAdvancePercent = 30;
  if (score >= 70) {
    tier = "HIGH";
    suggestedAdvancePercent = 70;
  } else if (score >= 35) {
    tier = "MEDIUM";
    suggestedAdvancePercent = 50;
  }

  return {
    score,
    tier,
    suggestedAdvancePercent,
    outstandingBalance: totalBalance,
    unpaidOrdersCount: unpaidCount,
    avgDaysToPay: Math.round(avgDaysToPay),
    totalOrders: orders.length,
    why: `Risk Score: ${score}/100 (${tier}). Outstanding balance: ₹${totalBalance.toLocaleString("en-IN")} across ${unpaidCount} unpaid orders. Avg payment cycle: ${Math.round(avgDaysToPay)} days.`,
  };
}

/**
 * Payment Risk Intelligence Module:
 * Analyzes all customers and generates insights for HIGH risk profiles.
 */
export async function runPaymentRisk() {
  const customers = await Customer.find({}).lean();
  const insights = [];

  for (const customer of customers) {
    const risk = await calculateCustomerRisk(customer._id.toString());

    if (risk.tier === "HIGH") {
      insights.push({
        type: "PAYMENT_RISK",
        severity: "WARNING",
        title: `High Credit Risk: ${customer.name}`,
        message: `${customer.name} has a high credit risk score of ${risk.score}/100 with ₹${risk.outstandingBalance.toLocaleString("en-IN")} outstanding.`,
        why: `Calculated Risk Score: ${risk.score}/100 (HIGH). Outstanding balance: ₹${risk.outstandingBalance.toLocaleString("en-IN")} across ${risk.unpaidOrdersCount} unpaid orders. Average fulfillment/settlement duration: ${risk.avgDaysToPay} days. Recommend minimum ${risk.suggestedAdvancePercent}% advance.`,
        entityType: "CUSTOMER",
        entityId: customer._id.toString(),
        dedupeKey: `payment_risk_${customer._id}`,
        metadata: {
          score: risk.score,
          tier: risk.tier,
          outstandingBalance: risk.outstandingBalance,
          unpaidOrdersCount: risk.unpaidOrdersCount,
          suggestedAdvancePercent: risk.suggestedAdvancePercent,
        },
      });
    }
  }

  return insights;
}
