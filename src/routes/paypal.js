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
// ❌ REMOVED: Insecure withdrawal route. Use /api/withdraw instead.

export default router;
