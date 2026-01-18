import express from "express";
import multer from "multer";
import path from "path";
import db from "../config/db.js";

const router = express.Router();

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// Submit Discount Request
import { createWorker } from 'tesseract.js';

router.post("/", upload.single("proof"), async (req, res) => {
    const { userId, bookingId } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (!userId || !bookingId) {
        return res.status(400).json({ error: "User ID and Booking ID are required" });
    }

    let extractedOrderId = null;

    // OCR Logic
    if (filePath) {
        try {
             const worker = await createWorker("eng");
             const { data: { text } } = await worker.recognize(path.resolve(filePath));
             await worker.terminate();
             
             console.log("📝 OCR Text:", text); // Debugging

             // Optimized Regex Patterns
             const patterns = [
                // 1. Strict "Order Number" followed by Alphanumeric (ignoring spaces)
                // Matches "Order number       K2V3N7YA"
                /Order\s+number\s+[:.-]?\s*([A-Za-z0-9]{3,})/i, 
                
                // 2. Strict "Booking ID"
                /Booking\s+ID\s*[:.-]?\s*([A-Za-z0-9-]{3,})/i,

                // 3. Fallback: Look for "Order #" BUT exclude common words "Confirmation", "Successful"
                /(?:Order|Booking)\s*(?:#|No\.?|Number)?\s*[:.-]?\s*(?!Confirmation|Successful|Detail)([A-Za-z0-9-]{5,})/i 
             ];

             for (const regex of patterns) {
                 const match = text.match(regex);
                 if (match && match[1]) {
                     extractedOrderId = match[1];
                     console.log("✅ Extracted Order ID:", extractedOrderId);
                     break; // Stop after first match
                 }
             }
        } catch (error) {
            console.error("❌ OCR Error:", error);
        }
    }

    // Generate Unique Request ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4 digit random
    const requestId = `#DSC-${Date.now().toString().slice(-6)}${randomSuffix}`;

    const sql = "INSERT INTO discount_requests (request_id, user_id, booking_id, file_path, extracted_order_id) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [requestId, userId, bookingId, filePath, extractedOrderId], (err, result) => {
        if (err) {
            console.error("❌ Error submitting discount request:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Request submitted successfully", id: result.insertId, requestId });
    });
});

// Get Request History
router.get("/:userId", (req, res) => {
    const { userId } = req.params;
    const sql = "SELECT * FROM discount_requests WHERE user_id = ? ORDER BY created_at DESC";

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching discount history:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// ✅ ADMIN: Get All Requests
import { creditUserBalanceById } from "../models/user.js";

router.get("/admin/all", (req, res) => {
    const sql = `
        SELECT dr.*, u.name as user_name, u.email as user_email 
        FROM discount_requests dr
        JOIN users u ON dr.user_id = u.id
        ORDER BY dr.created_at DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching all discounts:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// ✅ ADMIN: Update Request Status & Credit Balance
router.patch("/:requestId/status", (req, res) => {
    const { requestId } = req.params;
    const { status, amount, userId } = req.body; // amount = calculated discount

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    // Function to update status
    const updateStatus = () => {
        const sql = "UPDATE discount_requests SET status = ? WHERE id = ?";
        db.query(sql, [status, requestId], (err, result) => {
            if (err) {
                console.error("❌ Error updating discount status:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: `Request ${status} successfully` });
        });
    };

    // If Approved and Amount provided, Credit User
    if (status === 'Approved' && amount && userId) {
        creditUserBalanceById(userId, amount, (err) => {
             if (err) {
                 console.error("❌ Error crediting user balance:", err);
                 return res.status(500).json({ error: "Failed to credit user balance" });
             }
             // Then update status
             updateStatus();
        });
    } else {
        updateStatus();
    }
});

export default router;
