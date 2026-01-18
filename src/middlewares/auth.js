import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv"; // Add dotenv
import { createUser, createUserWithReferral, findUserByEmail, findUserByReferralCode } from "../models/user.js";
import db from "../config/db.js";

dotenv.config(); // Load env vars immediately

const router = express.Router();
const JWT_SECRET = "my_secret_key"; // In production, use environment variable

// Generate random referral code
function generateReferralCode() {
  return "CRYP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const verifyToken = (req, res, next) => {
  const token = req.headers["x-access-token"] || req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  // Remove "Bearer " if present
  const tokenString = token.startsWith("Bearer ") ? token.slice(7, token.length) : token;

  // Debugging logs
  // console.log("🔹 Auth Middleware Received Token:", tokenString.substring(0, 10) + "...");

  jwt.verify(tokenString, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ Token Verification Failed:", err.name, err.message);
      
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Token expired. Please login again." });
      }
      return res.status(401).json({ message: "Unauthorized! Invalid Token." });
    }
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  });
};

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

import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Ensure this is in .env

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

// ✅ GOOGLE AUTH ROUTE
router.post("/google", async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    findUserByEmail(email, (err, results) => {
      if (err) return res.status(500).json({ error: "Database error" });

      if (results.length > 0) {
        // User exists -> Login
        const user = results[0];
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
        return res.json({ message: "Login successful", token, user });
      } else {
        // User does not exist -> Create Account with Random Password
        const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
        
        bcrypt.hash(generatedPassword, 10, (err, hash) => {
          if (err) return res.status(500).json({ error: "Password hashing failed" });

          const newReferralCode = generateReferralCode();
          
          // Using registerUser logic directly or helper
          // For simplicity, calling createUserWithReferral directly here
          createUserWithReferral(name, email, hash, newReferralCode, null, (err, newUser) => {
            if (err) return res.status(500).json({ error: "User creation failed" });

            // Send password via email
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: email,
              subject: 'Your Pbookings Account Password',
              text: `Welcome to Pbookings, ${name}!\n\nYou have successfully signed up using Google.\n\nYour auto-generated password is: ${generatedPassword}\n\nYou can use this password to log in manually, or continue using Google Sign-In.\n\nBest regards,\nPbookings Team`
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) console.error('Error sending email:', error);
            });

            // Return Login Token
            // valid user object needs id (insertId from result)
            const token = jwt.sign({ id: newUser.insertId, email: email }, JWT_SECRET, { expiresIn: "1h" });
            
             // Construct user object to return
             const returnedUser = { id: newUser.insertId, name, email, referral_code: newReferralCode };
             res.json({ message: "User registered successfully!", token, user: returnedUser });
          });
        });
      }
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ message: "Invalid Google Token" });
  }
});

export default router;
