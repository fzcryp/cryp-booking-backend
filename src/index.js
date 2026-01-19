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
import discountRoutes from "./routes/discount.js"; // Import discount routes
import userProfileRoutes from "./routes/userProfile.js";
import supportRoutes from "./routes/support.js"; // Added import
import otpRoutes from "./routes/otp.js"; // <-- New
import subscribeRoutes from "./routes/subscribe.js"; // Import subscribe routes
import affiliateRoutes from "./routes/affiliate.js"; // Import affiliate routes
import hotelsRoutes from "./routes/hotels.js"; // Import hotels routes
import carsRoutes from "./routes/cars.js"; // Import cars routes
import flightsRoutes from "./routes/flights.js"; // Import flight routes
import locationsRoutes from "./routes/locations.js"; // Import location routes
import savedHotelsRoutes from "./routes/saved_hotels.js"; // Import saved hotels routes
import savedFlightsRoutes from "./routes/saved_flights.js"; // Import saved flights routes
import contactRoutes from "./routes/contact.js"; // Import Contact Us routes

// Initialized app below
dotenv.config();

const app = express();
const API_KEY = process.env.AMADEUS_CLIENT_ID;
const API_SECRET = process.env.AMADEUS_CLIENT_SECRET;

let accessToken = null;
let tokenExpiresAt = 0;

// Middleware
const allowedOrigins = [
  "http://localhost:4200", 
  "http://localhost:5000", 
  "http://localhost:8100",
  "https://www.pbookings.com", 
  "https://pbookings.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(null, true); // Temporarily true for debugging
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-access-token"]
}));

// Enable pre-flight - using regex to avoid Express 5/path-to-regexp error
app.options(/.*/, cors());

app.use(bodyParser.json());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`📢 ${req.method} ${req.url} from Origin: ${req.headers.origin}`);
  next();
});

// Database connection check handled in db.js
async function getAccessToken() {
    const now = Date.now();
    if (accessToken && now < tokenExpiresAt) {
        return accessToken;
    }

    try {
        console.log('Fetching new Access Token...');
        const response = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', 
            new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': API_KEY,
                'client_secret': API_SECRET
            }), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        accessToken = response.data.access_token;
        tokenExpiresAt = now + (response.data.expires_in * 1000) - 60000;
        return accessToken;
    } catch (error) {
        console.error('Auth Error:', error.response?.data || error.message);
        throw error;
    }
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/withdraw", withdrawRoutes); // <-- NEW
app.use("/api/paypal", paypalRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/discounts", discountRoutes); // Register discount routes
app.use("/api/support", supportRoutes); // Added
app.use("/api/user/profile", userProfileRoutes);
app.use("/api/otp", otpRoutes); // <-- New OTP Routes
app.use("/api/subscribe", subscribeRoutes); // Register subscribe routes
app.use("/api/affiliates", affiliateRoutes); // Register affiliate routes
app.use("/api/hotels", hotelsRoutes); // Register affiliate routes
app.use("/api/cars", carsRoutes); // Register car routes
app.use("/api/flights", flightsRoutes); // Register flight routes
app.use("/api/locations", locationsRoutes); // Register location suggestions
app.use("/api/saved-hotels", savedHotelsRoutes); // Register saved hotels routes
app.use("/api/saved-flights", savedFlightsRoutes); // Register saved flights routes
app.use("/api/contact", contactRoutes); // Register Contact Us routes

// Serve uploads folder statically
app.use("/uploads", express.static("uploads"));

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
