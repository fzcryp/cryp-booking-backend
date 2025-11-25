import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import authRoutes from "./middlewares/auth.js";
import db from "./config/db.js";
import transactionRoutes from "./routes/transaction.js";
import userRoutes from "./routes/user.js";
import withdrawRoutes from "./routes/withdraw.js"; // <-- NEW
import paypalRoutes from "./routes/paypal.js";
import referralRoutes from "./routes/referral.js";
import userProfileRoutes from "./routes/userProfile.js";
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Database connection check
db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database.");
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/withdraw", withdrawRoutes); // <-- NEW
app.use("/api/paypal", paypalRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/user/profile", userProfileRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("Welcome to CrypBooking API 🚀");
});
// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled server error:", err.stack);
  res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
