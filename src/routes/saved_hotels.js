import express from "express";
import { saveHotel, removeHotel, getSavedHotels, isHotelSaved } from "../models/saved_hotels.js";

const router = express.Router();

// Save a hotel
router.post("/", (req, res) => {
  const { user_email, hotel_id, hotel_name, hotel_data } = req.body;

  if (!user_email || !hotel_id || !hotel_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  saveHotel(user_email, hotel_id, hotel_name, hotel_data, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
           return res.status(409).json({ message: "Hotel already saved" });
      }
      console.error("Error saving hotel:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Hotel saved successfully", id: result.insertId });
  });
});

// Remove a saved hotel
router.delete("/:user_email/:hotel_id", (req, res) => {
  const { user_email, hotel_id } = req.params;

  removeHotel(user_email, hotel_id, (err, result) => {
    if (err) {
      console.error("Error removing hotel:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ message: "Hotel removed successfully" });
  });
});

// Get all saved hotels for a user
router.get("/:user_email", (req, res) => {
  const { user_email } = req.params;

  getSavedHotels(user_email, (err, results) => {
    if (err) {
      console.error("Error fetching saved hotels:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Check if saved
router.get("/check/:user_email/:hotel_id", (req, res) => {
    const { user_email, hotel_id } = req.params;
  
    isHotelSaved(user_email, hotel_id, (err, results) => {
      if (err) {
        console.error("Error checking saved hotel:", err);
        return res.status(500).json({ error: "Database error" });
      }
      const isSaved = results[0].count > 0;
      res.json({ isSaved });
    });
  });

export default router;
