import express from "express";
import db from "../config/db.js";

const router = express.Router();

// ⭐ Get referral history for current logged-in user
router.get("/history/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
        SELECT 
            rr.id,
            rr.reward_amount,
            rr.discount_amount,
            rr.booking_amount,
            rr.created_at,
            u.name AS referred_user
        FROM referral_rewards rr
        JOIN users u ON u.id = rr.referred_user_id
        WHERE rr.referrer_id = ?
        ORDER BY rr.created_at DESC
    `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching referral history:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({ history: results });
  });
});

export default router;
