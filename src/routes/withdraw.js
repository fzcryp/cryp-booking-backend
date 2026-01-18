import express from "express";
import fetch from "node-fetch"; // optional: Node 18 has global fetch; node-fetch ok too
import {
  getUserBalance,
  deductUserBalance,
  creditUserBalance,
} from "../models/user.js";
import { saveWithdrawalTransaction } from "../models/transaction.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

// load env happens at runtime now to ensure dotenv is loaded
// const PAYPAL_API = process.env.PAYPAL_API || "https://api-m.sandbox.paypal.com"; 

// Helper to get fresh env vars
const getPayPalConfig = () => ({
  clientId: process.env.PAYPAL_CLIENT_ID,
  secret: process.env.PAYPAL_SECRET,
  api: process.env.PAYPAL_API || "https://api-m.sandbox.paypal.com"
});

/**
 * POST /api/withdraw
 * body: { user_email, amount, paypal_email }
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { user_email, amount, paypal_email } = req.body;

    if (!user_email || !paypal_email || !amount) {
      return res
        .status(400)
        .json({ error: "user_email, paypal_email and amount are required" });
    }

    const requestedAmount = parseFloat(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 1) Check user balance
    getUserBalance(user_email, async (err, rows) => {
      if (err) {
        console.error("DB error fetching balance:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const balance = parseFloat(rows[0].balance || 0);
      if (balance < requestedAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // 2) Calculate fees
      const paypalFee = round2(requestedAmount * 0.044); // 4.4%
      const platformFee = round2(requestedAmount * 0.02); // 2%
      const totalFee = round2(paypalFee + platformFee);
      const finalAmount = round2(requestedAmount - totalFee);

      // 3) Deduct full requested amount from user balance
      deductUserBalance(user_email, requestedAmount, async (err, result) => {
        if (err) {
          console.error("DB error deducting balance:", err);
          return res
            .status(500)
            .json({ error: "Database error while deducting balance" });
        }

        if (!result || result.affectedRows === 0) {
          return res
            .status(400)
            .json({ error: "Insufficient balance or user not found" });
        }

        // 4) Attempt PayPal Payout
        try {
          const accessToken = await getPayPalAccessToken();
          const payoutRes = await createPayPalPayout(
            accessToken,
            finalAmount,
            paypal_email
          );

          // Save successful withdrawal transaction record
          const tx = {
            transaction_id: payoutRes.batch_id || generateId("WD"),
            payer_name: user_email,
            amount_requested: requestedAmount,
            paypal_fee: paypalFee,
            platform_fee: platformFee,
            total_fee: totalFee,
            final_amount: finalAmount,
            currency: "USD",
            status: "COMPLETED",
            date: new Date().toISOString(),
            user_email,
            paypal_payout_id:
              payoutRes.batch_id || payoutRes.payout_item_id || null,
            notes: JSON.stringify(payoutRes),
          };

          saveWithdrawalTransaction(tx, (saveErr, saveRes) => {
            if (saveErr) {
              console.error("DB error saving transaction:", saveErr);
              // Note: payout already went through. We should still inform client but log the error.
              return res
                .status(201)
                .json({
                  message: "Payout completed but failed to save transaction",
                  payout: payoutRes,
                });
            }
            return res
              .status(201)
              .json({
                message: "Withdrawal completed",
                payout: payoutRes,
                transaction: tx,
              });
          });
        } catch (pErr) {
          console.error("PayPal payout error:", pErr);

          // Try to restore the deducted balance because payout failed
          creditUserBalance(user_email, requestedAmount, (creditErr) => {
            if (creditErr) {
              console.error(
                "Critical: failed to restore user balance after payout failure:",
                creditErr
              );
            }
            // Save failed transaction record
            const failedTx = {
              transaction_id: generateId("WD-FAIL"),
              payer_name: user_email,
              amount_requested: requestedAmount,
              paypal_fee: paypalFee,
              platform_fee: platformFee,
              total_fee: totalFee,
              final_amount: 0.0,
              currency: "USD",
              status: "FAILED",
              date: new Date().toISOString(),
              user_email,
              paypal_payout_id: null,
              notes: `payout_error: ${String(pErr)}`,
            };

            saveWithdrawalTransaction(failedTx, (saveErr2) => {
              if (saveErr2) {
                console.error("DB error saving failed transaction:", saveErr2);
              }
              return res
                .status(500)
                .json({
                  error: "Payout failed, amount restored to user (if possible)",
                  details: String(pErr),
                });
            });
          });
        }
      }); // deductUserBalance
    }); // getUserBalance
  } catch (e) {
    console.error("Unexpected withdraw error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ---------- Helpers ---------- */

// Round to 2 decimals
function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function generateId(prefix = "TX") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

// Get OAuth token from PayPal
// Get OAuth token from PayPal
async function getPayPalAccessToken() {
  const { clientId, secret, api } = getPayPalConfig();
  
  if (!clientId || !secret) {
    throw new Error("PayPal credentials not configured in env");
  }

  const creds = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const tokenUrl = `${api}/v1/oauth2/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${txt}`);
  }
  const json = await res.json();
  return json.access_token;
}

// Create a single payout (simple example using single item)
async function createPayPalPayout(accessToken, amount, receiverEmail) {
  const { api } = getPayPalConfig();
  const url = `${api}/v1/payments/payouts`;

  // Unique sender_batch_id
  const batchId = `batch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const body = {
    sender_batch_header: {
      sender_batch_id: batchId,
      email_subject: "You have a payout from CrypBooking",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: amount.toFixed(2),
          currency: "USD",
        },
        receiver: receiverEmail,
        note: "Withdrawal from CrypBooking wallet",
        sender_item_id: `item_${Date.now()}`,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  // return some useful ids
  return {
    batch_id: json.batch_header?.payout_batch_id || null,
    links: json.links || null,
    raw: json,
  };
}

export default router;
