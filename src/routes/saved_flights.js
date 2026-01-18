import express from "express";
import db from "../config/db.js";

const router = express.Router();

// 1. Save Flight
router.post("/save", (req, res) => {
    const { userEmail, flight } = req.body;

    if (!userEmail || !flight) {
        return res.status(400).json({ error: "User email and flight data are required" });
    }

    // Use a unique ID from the flight data, or generate one if complex
    // Amadeus flights have 'id' usually.
    const flightId = flight.id || `FLT-${Date.now()}`;

    const sql = "INSERT INTO saved_flights (user_email, flight_id, flight_data) VALUES (?, ?, ?)";
    db.query(sql, [userEmail, flightId, JSON.stringify(flight)], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: "Flight already saved" });
            }
            console.error("Error saving flight:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Flight saved successfully" });
    });
});

// 2. Get User's Saved Flights
router.get("/:userEmail", (req, res) => {
    const { userEmail } = req.params;
    const sql = "SELECT * FROM saved_flights WHERE user_email = ? ORDER BY created_at DESC";

    db.query(sql, [userEmail], (err, results) => {
        if (err) {
            console.error("Error fetching saved flights:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 3. Remove Flight
router.delete("/:userEmail/:flightId", (req, res) => {
    const { userEmail, flightId } = req.params;
    const sql = "DELETE FROM saved_flights WHERE user_email = ? AND flight_id = ?";

    db.query(sql, [userEmail, flightId], (err, result) => {
        if (err) {
            console.error("Error removing flight:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Flight removed successfully" });
    });
});

export default router;
