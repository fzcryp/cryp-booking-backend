import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { updateUserBalance } from "../models/user.js";

dotenv.config();
const router = express.Router();

// Helper: Get PayPal Access Token
export const getPayPalAccessToken = async () => {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      `${process.env.PAYPAL_API}/v1/oauth2/token`,
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error(
      "❌ Failed to get PayPal token:",
      error.response?.data || error.message
    );
    throw new Error("PayPal authentication failed");
  }
};

// ✅ Route: Process Withdrawal Request
router.post("/withdraw", async (req, res) => {
  const { email, finalAmount } = req.body;

  try {
    const accessToken = await getPayPalAccessToken();

    const payoutBody = {
      sender_batch_header: {
        sender_batch_id: `batch_${Date.now()}`,
        email_subject: "You have a payout!",
        email_message: "You have received a payout from CrypBooking.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: finalAmount.toFixed(2),
            currency: "USD",
          },
          receiver: email,
          note: "Thank you for using CrypBooking.",
          sender_item_id: `item_${Date.now()}`,
        },
      ],
    };

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v1/payments/payouts`,
      payoutBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json({
      message: "Withdrawal processed successfully",
      paypalResponse: response.data,
    });
  } catch (error) {
    console.error(
      "❌ PayPal Withdrawal Error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Withdrawal failed",
      details: error.response?.data || error.message,
    });
  }
});

export default router;
