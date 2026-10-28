import cron from "node-cron";
import Insight from "../models/Insight.js";
import { runDemandSpike } from "./modules/demandSpike.js";
import { runSlowStock } from "./modules/slowStock.js";
import { runStockIntegrity } from "./modules/stockIntegrity.js";
import { runOrderFlow } from "./modules/orderFlow.js";
import { runPaymentRisk } from "./modules/paymentRisk.js";
import { runLowStock } from "./modules/lowStock.js";

const MODULES = [
  { name: "LOW_STOCK", runner: runLowStock },
  { name: "DEMAND_SPIKE", runner: runDemandSpike },
  { name: "SLOW_STOCK", runner: runSlowStock },
  { name: "STOCK_INTEGRITY", runner: runStockIntegrity },
  { name: "ORDER_FLOW", runner: runOrderFlow },
  { name: "PAYMENT_RISK", runner: runPaymentRisk },
];

let isRunning = false;
let cronTask = null;

/**
 * Runs all intelligence modules safely and independently.
 * Fault-tolerant: failure in one module will never crash or prevent others.
 */
export async function runIntelligenceEngine() {
  if (isRunning) {
    console.log("[Intelligence Engine] Run already in progress, skipping overlapping run.");
    return { status: "skipped", message: "Run already in progress" };
  }

  isRunning = true;
  const startTime = Date.now();
  console.log(`[Intelligence Engine] Starting intelligence cycle with ${MODULES.length} modules...`);

  const summary = {
    totalGenerated: 0,
    totalAutoResolved: 0,
    moduleResults: {},
  };

  try {
    for (const mod of MODULES) {
      try {
        console.log(`[Intelligence Engine] Running module: ${mod.name}...`);
        const generatedInsights = await mod.runner();
        const activeDedupeKeys = new Set();

        let moduleUpserted = 0;
        for (const item of generatedInsights) {
          activeDedupeKeys.add(item.dedupeKey);

          const existing = await Insight.findOne({ dedupeKey: item.dedupeKey });
          const newStatus = existing && existing.status === "ACKED" ? "ACKED" : "OPEN";

          await Insight.findOneAndUpdate(
            { dedupeKey: item.dedupeKey },
            {
              $set: {
                ...item,
                status: newStatus,
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true, returnDocument: "after" }
          );
          moduleUpserted++;
        }

        // Auto-resolve any OPEN or ACKED insights for this type that are no longer triggered
        const resolveResult = await Insight.updateMany(
          {
            type: mod.name,
            status: { $in: ["OPEN", "ACKED"] },
            dedupeKey: { $nin: Array.from(activeDedupeKeys) },
          },
          {
            $set: {
              status: "RESOLVED",
              resolvedAt: new Date(),
            },
          }
        );

        const autoResolvedCount = resolveResult.modifiedCount || 0;
        summary.totalGenerated += moduleUpserted;
        summary.totalAutoResolved += autoResolvedCount;
        summary.moduleResults[mod.name] = {
          success: true,
          activeCount: generatedInsights.length,
          upserted: moduleUpserted,
          autoResolved: autoResolvedCount,
        };
      } catch (modErr) {
        console.error(`[Intelligence Engine] Error running module ${mod.name}:`, modErr.message);
        summary.moduleResults[mod.name] = {
          success: false,
          error: modErr.message,
        };
      }
    }
  } finally {
    isRunning = false;
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[Intelligence Engine] Completed in ${durationMs}ms. Active insights: ${summary.totalGenerated}, Auto-resolved: ${summary.totalAutoResolved}.`
  );
  return { durationMs, ...summary };
}

/**
 * Initializes the node-cron scheduled runner based on INTELLIGENCE_CRON
 * Default: every 15 minutes ("* /15 * * * *")
 */
export function startIntelligenceScheduler() {
  const cronExpression = process.env.INTELLIGENCE_CRON || "*/15 * * * *";

  if (!cron.validate(cronExpression)) {
    console.error(`[Intelligence Engine] Invalid INTELLIGENCE_CRON expression: "${cronExpression}". Falling back to "*/15 * * * *".`);
  }

  const validExpr = cron.validate(cronExpression) ? cronExpression : "*/15 * * * *";

  cronTask = cron.schedule(validExpr, async () => {
    try {
      await runIntelligenceEngine();
    } catch (err) {
      console.error("[Intelligence Engine] Scheduled cycle failed:", err);
    }
  });

  console.log(`[Intelligence Engine] Scheduled cron task initialized with schedule: "${validExpr}".`);

  // Run initial cycle asynchronously shortly after startup
  setTimeout(() => {
    runIntelligenceEngine().catch((err) => {
      console.error("[Intelligence Engine] Initial startup run error:", err.message);
    });
  }, 3000);
}

export function stopIntelligenceScheduler() {
  if (cronTask) {
    cronTask.stop();
    console.log("[Intelligence Engine] Scheduled cron task stopped.");
  }
}
