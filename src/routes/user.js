import express from "express";
import { getUserBalance, updateUserBalance } from "../models/user.js";
import db from "../config/db.js";

const router = express.Router();

// ✅ Get User Balance
router.get("/balance/:email", (req, res) => {
  const { email } = req.params;

  getUserBalance(email, (err, result) => {
    if (err) {
      console.error("Error fetching balance:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ balance: result[0].balance });
  });
});

// ✅ Update User Balance (deduct amount)
router.patch("/update-balance/:email", (req, res) => {
  const { email } = req.params;
  const { amount } = req.body;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  updateUserBalance(email, amount, (err, result) => {
    if (err) {
      console.error("Error updating balance:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res
        .status(400)
        .json({ message: "Insufficient balance or user not found" });
    }

    res.json({ message: "Balance updated successfully" });
  });
});

router.get("/profile/:id", (req, res) => {
  const userId = req.params.id;

  // Step 1: Get user details
  const userSql = `SELECT id, name, email, referral_code, balance FROM users WHERE id = ?`;

  db.query(userSql, [userId], (err, userResult) => {
    if (err)
      return res.status(500).json({ message: "Database error", error: err });
    if (!userResult.length)
      return res.status(404).json({ message: "User not found" });

    const user = userResult[0];

    // Step 2: Get referral history
    const referralSql = `
      SELECT rr.id, rr.reward_amount, rr.booking_amount, rr.created_at, u.name AS referred_user
      FROM referral_rewards rr
      JOIN users u ON u.id = rr.referred_user_id
      WHERE rr.referrer_id = ?
      ORDER BY rr.created_at DESC
    `;

    db.query(referralSql, [userId], (err, referrals) => {
      if (err)
        return res.status(500).json({ message: "Database error", error: err });

      // Step 3: Calculate total bookings and total rewards
      const totalBookings = referrals.length;
      const totalRewards = referrals.reduce(
        (sum, r) => sum + Number(r.reward_amount),
        0
      );

      res.json({
        user,
        referralHistory: referrals,
        totalBookings,
        totalRewards,
      });
    });
  });
});
export default router;
