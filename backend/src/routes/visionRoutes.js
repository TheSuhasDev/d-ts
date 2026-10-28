import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, or WebP images are allowed"), false);
    }
  },
});

const router = express.Router();

// Require authenticated user for all vision calls
router.use(requireAuth);

router.post("/predict", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided" });
  }

  const aiApiUrl = process.env.AI_API_URL || "http://127.0.0.1:8001";
  const aiApiKey = process.env.AI_API_KEY || "";

  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname || "warehouse-frame.jpg");

    const headers = {};
    if (aiApiKey) {
      headers["X-AI-API-KEY"] = aiApiKey;
    }

    const aiRes = await fetch(`${aiApiUrl}/predict`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await aiRes.json();
    return res.status(aiRes.status).json(data);
  } catch (error) {
    console.error("[Vision Proxy Error]:", error.message);
    return res.status(503).json({
      message: "Vision AI service is unavailable. Make sure the FastAPI service is running.",
      error: error.message,
    });
  }
});

export default router;
