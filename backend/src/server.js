import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import visionRoutes from "./routes/visionRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import customerRoutes from "./routes/customerRoutes.js";
import insightRoutes from "./routes/insightRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import { startIntelligenceScheduler } from "./intelligence/index.js";
import logger from "./config/logger.js";
import { ensurePaymentIndexes } from "./models/Payment.js";
import { migrateOrderStatuses } from "./models/Order.js";
import { backfillOrderNumbers } from "./services/sequenceService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Process-level unhandled rejection and uncaught exception handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[CRITICAL] Uncaught Exception thrown:", error);
});

// Production validation for JWT_SECRET
const PLACEHOLDER_SECRETS = [
  "your_jwt_secret_key",
  "secret",
  "changeme",
  "change_me",
  "placeholder",
  "123456",
  "denika_aiwms_1234",
];

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is missing. Server cannot start.");
  process.exit(1);
}

if (
  process.env.NODE_ENV === "production" &&
  (PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET.trim().toLowerCase()) ||
    process.env.JWT_SECRET.trim().length < 16)
) {
  console.error(
    "FATAL ERROR: JWT_SECRET is unset, too short (<16 chars), or using a known placeholder in production."
  );
  process.exit(1);
}

const app = express();

// Security headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// MongoDB Query Injection Sanitization (Express 5 compatible in-place)
app.use((req, res, next) => {
  ["body", "params", "headers", "query"].forEach((key) => {
    if (req[key] && typeof req[key] === "object") {
      mongoSanitize.sanitize(req[key]);
    }
  });
  next();
});

// Dynamic CORS configuration (accepts any localhost / 127.0.0.1 port for development & custom origins)
const customOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost || customOrigins.includes(origin) || customOrigins.includes("*")) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Rate limiting on mutating write endpoints (POST, PATCH, PUT, DELETE)
const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 mutating requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many write requests from this IP, please try again after a minute." },
});

app.use((req, res, next) => {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    return writeRateLimiter(req, res, next);
  }
  next();
});

// Static assets (product images)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Core API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/vision", visionRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "AI Warehouse System API is running",
    status: "healthy",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error({ err }, `[Server Error]: ${err.message}`);
  const status = err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(status).json({
    success: false,
    message: err.message || "An unexpected internal server error occurred",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await ensurePaymentIndexes();
    await migrateOrderStatuses();
    await backfillOrderNumbers();
    startIntelligenceScheduler();
    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error({ error }, "Server failed to start");
    process.exitCode = 1;
  }
};

startServer();