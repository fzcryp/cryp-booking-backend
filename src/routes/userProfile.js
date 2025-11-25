import express from "express";
import db from "../config/db.js";

const router = express.Router();

// Get user profile with referrals, rewards, bookings
router.get("/:userId", (req, res) => {
  const userId = req.params.userId;

  // Step 1: Get user info
  const userQuery = `SELECT id, name, email, referral_code FROM users WHERE id = ?`;

  db.query(userQuery, [userId], (err, userResults) => {
    if (err) {
      console.error("❌ Error fetching user info:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResults[0];

    // Step 2: Get referral history
    const referralQuery = `
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

    db.query(referralQuery, [userId], (err, referralResults) => {
      if (err) {
        console.error("❌ Error fetching referral history:", err);
        return res.status(500).json({ error: "Database error" });
      }

      // Step 3: Get total bookings
      const bookingsQuery = `
        SELECT COUNT(*) AS totalBookings 
        FROM bookings 
        WHERE user_id = ?
      `;

      db.query(bookingsQuery, [userId], (err, bookingsResults) => {
        if (err) {
          console.error("❌ Error fetching bookings:", err);
          return res.status(500).json({ error: "Database error" });
        }

        const totalBookings = bookingsResults[0].totalBookings;

        // Step 4: Calculate total rewards
        const totalRewards = referralResults.reduce(
          (acc, item) => acc + (item.reward_amount || 0),
          0
        );

        // Step 5: Send combined response
        res.json({
          user,
          referralHistory: referralResults,
          totalBookings,
          totalRewards,
        });
      });
    });
  });
});

export default router;
