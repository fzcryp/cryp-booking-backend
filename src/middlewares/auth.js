import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, createUserWithReferral, findUserByEmail, findUserByReferralCode } from "../models/user.js";
import db from "../config/db.js";

const router = express.Router();
const JWT_SECRET = "my_secret_key"; // In production, use environment variable

// Generate random referral code
function generateReferralCode() {
  return "CRYP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ⭐ UPDATED SIGNUP
router.post("/signup", (req, res) => {
  const { name, email, password, referral_code } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  findUserByEmail(email, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (results.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // STEP 1 — Check if referral code is valid
    if (referral_code) {
      findUserByReferralCode(referral_code, (err, referrerResult) => {
        if (err) return res.status(500).json({ error: "Database error" });

        const referrer_id = referrerResult.length ? referrerResult[0].id : null;

        // Continue signup
        registerUser(name, email, password, referrer_id);
      });
    } else {
      registerUser(name, email, password, null);
    }
  });

function registerUser(name, email, password, referrer_id) {
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: "Password hashing failed" });

    const newReferralCode = generateReferralCode();

    createUserWithReferral(
      name,
      email,
      hash,
      newReferralCode,
      referrer_id,
      (err, newUser) => {
        if (err) return res.status(500).json({ error: "User creation failed" });

        // ⭐ Add referral reward entry if referrer exists
        if (referrer_id) {
          const sql = `
          INSERT INTO referral_rewards
          (referrer_id, referred_user_id, reward_amount, discount_amount, booking_amount, created_at)
          VALUES (?, ?, 0, 0, 0, NOW())
        `;
          db.query(sql, [referrer_id, newUser.insertId], (err) => {
            if (err) console.error("❌ Error inserting referral reward:", err);
          });
        }

        res.json({
          message: "User registered successfully!",
          referral_code: newReferralCode,
        });
      }
    );
  });
}

});


// ✅ Login Route
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log("🟡 Login request received:", email);

  if (!email || !password) {
    console.error("❌ Missing email or password in request");
    return res.status(400).json({ message: "Email and password are required" });
  }

  findUserByEmail(email, (err, results) => {
    if (err) {
      console.error("❌ Database error on findUserByEmail (login):", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      console.warn("⚠️ No user found with email:", email);
      return res.status(400).json({ message: "User not found" });
    }

    const user = results[0];
    console.log("👤 User found:", user.email);

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("❌ Error comparing passwords:", err);
        return res.status(500).json({ error: "Password comparison failed" });
      }

      if (!isMatch) {
        console.warn("⚠️ Invalid password for user:", email);
        return res.status(400).json({ message: "Invalid password" });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: "1h",
      });

      console.log("✅ Login successful for user:", email);
      res.json({ message: "Login successful", token, user });
    });
  });
});

export default router;
