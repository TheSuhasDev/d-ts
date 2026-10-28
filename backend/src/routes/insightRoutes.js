import express from "express";
import Insight from "../models/Insight.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { runIntelligenceEngine } from "../intelligence/index.js";

const router = express.Router();

/**
 * GET /api/insights
 * Query filters: status, severity, type, entityType, limit
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { status, severity, type, entityType, limit = 50 } = req.query;
    const filter = {};

    if (status) {
      filter.status = status.toUpperCase();
    }
    if (severity) {
      filter.severity = severity.toUpperCase();
    }
    if (type) {
      filter.type = type.toUpperCase();
    }
    if (entityType) {
      filter.entityType = entityType.toUpperCase();
    }

    const insights = await Insight.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Number(limit) || 50))
      .lean();

    // Summary counts for dashboard / notification bell
    const summaryCounts = await Insight.aggregate([
      { $match: { status: { $in: ["OPEN", "ACKED"] } } },
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {
      CRITICAL: 0,
      WARNING: 0,
      INFO: 0,
      totalUnresolved: 0,
    };

    summaryCounts.forEach((item) => {
      if (counts[item._id] !== undefined) {
        counts[item._id] = item.count;
      }
      counts.totalUnresolved += item.count;
    });

    res.json({
      success: true,
      counts,
      insights,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch insights" });
  }
});

/**
 * PATCH /api/insights/:id/ack
 * Acknowledges an open insight (Admin only)
 */
router.patch("/:id/ack", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight) {
      return res.status(404).json({ success: false, message: "Insight not found" });
    }

    insight.status = "ACKED";
    insight.ackedAt = new Date();
    insight.ackedBy = req.user?.name || "Admin";
    await insight.save();

    res.json({ success: true, message: "Insight acknowledged", insight });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Failed to acknowledge insight" });
  }
});

/**
 * PATCH /api/insights/:id/resolve
 * Manually marks an insight as resolved (Admin only)
 */
router.patch("/:id/resolve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const insight = await Insight.findById(req.params.id);
    if (!insight) {
      return res.status(404).json({ success: false, message: "Insight not found" });
    }

    insight.status = "RESOLVED";
    insight.resolvedAt = new Date();
    await insight.save();

    res.json({ success: true, message: "Insight marked as resolved", insight });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Failed to resolve insight" });
  }
});

/**
 * POST /api/insights/run
 * On-demand manual trigger for the intelligence engine (Admin only)
 */
router.post("/run", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await runIntelligenceEngine();
    res.json({
      success: true,
      message: "Intelligence engine cycle executed",
      result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to run intelligence engine" });
  }
});

export default router;
