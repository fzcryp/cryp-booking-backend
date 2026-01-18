import express from "express";
import db from "../config/db.js";

const router = express.Router();

// POST /api/contact - Submit a new contact request
router.post("/", (req, res) => {
    const { full_name, mobile_number, subject } = req.body;

    // Validation
    if (!full_name || !mobile_number || !subject) {
        return res.status(400).json({ status: "error", message: "All fields are required." });
    }

    const query = "INSERT INTO contact_us (full_name, mobile_number, subject) VALUES (?, ?, ?)";
    db.query(query, [full_name, mobile_number, subject], (err, result) => {
        if (err) {
            console.error("Error inserting contact request:", err);
            return res.status(500).json({ status: "error", message: "Internal Server Error" });
        }
        res.status(201).json({ status: "success", message: "Contact request submitted successfully!", id: result.insertId });
    });
});

// GET /api/contact - Fetch all contact requests (Admin)
router.get("/", (req, res) => {
    const query = "SELECT * FROM contact_us ORDER BY created_at DESC";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching contact requests:", err);
            return res.status(500).json({ status: "error", message: "Internal Server Error" });
        }
        res.status(200).json({ status: "success", data: results });
    });
});

export default router;
