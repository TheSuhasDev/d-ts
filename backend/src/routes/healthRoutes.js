import express from "express";
import mongoose from "mongoose";
import { getLocalIp } from "../utils/network.js";

const router = express.Router();

/**
 * GET /api/health
 * Reports DB, AI vision, and network address status
 */
router.get("/", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const aiUrl = process.env.AI_API_URL || "http://127.0.0.1:8001";
  let visionStatus = "offline";
  let visionDetails = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const visionRes = await fetch(`${aiUrl}/`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (visionRes.ok) {
      visionStatus = "online";
      try {
        visionDetails = await visionRes.json();
      } catch {
        visionDetails = { status: "ok" };
      }
    } else {
      visionStatus = "degraded";
    }
  } catch (err) {
    visionStatus = "offline";
    visionDetails = { error: err.message };
  }

  const isHealthy = dbStatus === "connected";
  const statusCode = isHealthy ? 200 : 503;
  const lanIp = getLocalIp();
  const port = process.env.PORT || 5000;
  const publicDomain = `${lanIp}.sslip.io`;
  const publicUrl = process.env.PUBLIC_URL || `http://${publicDomain}:${port}`;

  res.status(statusCode).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    lanIp,
    publicDomain,
    publicUrl,
    services: {
      database: {
        status: dbStatus,
        mode: mongoose.connection?.client?.topology?.description?.type || "standalone",
      },
      visionService: {
        status: visionStatus,
        endpoint: aiUrl,
        details: visionDetails,
      },
      intelligenceEngine: {
        status: "active",
        cron: process.env.INTELLIGENCE_CRON || "*/15 * * * *",
      },
      whatsappCloud: {
        configured: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        hasTemplate: Boolean(process.env.WHATSAPP_INVOICE_TEMPLATE),
      },
    },
  });
});

export default router;
