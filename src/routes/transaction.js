import express from "express";
import {
  saveTransaction,
  getTransactionsByUser,
} from "../models/transaction.js";

const router = express.Router();

// ✅ Save a new transaction
router.post("/", (req, res) => {
  const transaction = req.body;

  if (!transaction.user_email) {
    return res.status(400).json({ error: "User email required" });
  }

  saveTransaction(transaction, (err, result) => {
    if (err) {
      console.error("❌ DB Insert Error:", err);
      return res.status(500).json({ error: "Database error", details: err });
    }
    res.status(201).json({ message: "Transaction saved successfully", result });
  });
});

// ✅ Get all transactions for a specific user
router.get("/:email", (req, res) => {
  const { email } = req.params;

  getTransactionsByUser(email, (err, results) => {
    if (err) {
      console.error("❌ Fetch Error:", err);
      return res.status(500).json({ error: "Database error", details: err });
    }
    res.json(results);
  });
});

export default router;
