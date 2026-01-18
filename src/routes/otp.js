import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// In-memory OTP store: Map<email, { otp, expiresAt }>
const otpStore = new Map();

// Helper: Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Fix for "self-signed certificate" error locally
  }
});

// Helper: Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /api/otp/send
 * Body: { email }
 */
router.post("/send", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

  // Save to memory
  otpStore.set(email, { otp, expiresAt });

  console.log(`🔹 OTP for ${email}: ${otp}`); // Log for debugging (remove in prod)

  const mailOptions = {
    from: `"CrypBooking Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Withdrawal Verification Code",
    text: `Your verification code for withdrawals is: ${otp}. This code expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #0070ba;">Confirm Your Withdrawal</h2>
        <p>Please use the following OTP to verify your identity and complete your withdrawal request.</p>
        <h1 style="letter-spacing: 5px; color: #333;">${otp}</h1>
        <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ Email credentials missing. OTP logged to console only.");
      return res.status(200).json({ message: "OTP sent (Logged to console testing mode)" });
    }

    await transporter.sendMail(mailOptions);
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ error: "Failed to send OTP email" });
  }
});

/**
 * POST /api/otp/verify
 * Body: { email, otp }
 */
router.post("/verify", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({ error: "No OTP found for this email" });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  // Valid OTP
  otpStore.delete(email); // Invalidate after use
  return res.json({ message: "OTP Verified successfully" });
});

export default router;
