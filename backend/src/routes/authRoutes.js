import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again after 15 minutes" },
});

import { validateBody } from "../middleware/validate.js";
import { loginSchema, changePasswordSchema } from "../schemas/index.js";

// POST /login
router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.json({
      token,
      user: userObj,
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// POST /change-password
router.post("/change-password", requireAuth, validateBody(changePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.mustChangePassword = false;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully. You can now continue.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Password update failed", error: error.message });
  }
});

// POST /skip-password-change
router.post("/skip-password-change", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.mustChangePassword = false;
    await user.save();
    return res.json({
      success: true,
      message: "Password reset requirement dismissed.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to dismiss password reset", error: error.message });
  }
});

// GET /me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userObj = req.user.toObject ? req.user.toObject() : req.user;
    if (userObj.passwordHash) {
      delete userObj.passwordHash;
    }
    return res.json(userObj);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch user", error: error.message });
  }
});

export default router;
