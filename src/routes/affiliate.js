import express from "express";
import db from "../config/db.js";

const router = express.Router();

// Get all affiliate partners (public + admin)
router.get("/", (req, res) => {
  const query = "SELECT * FROM affiliate_partners WHERE is_active = TRUE ORDER BY sort_order ASC, created_at ASC";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching affiliates:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// Admin: Get all (including inactive)
router.get("/admin", (req, res) => {
    const query = "SELECT * FROM affiliate_partners ORDER BY sort_order ASC, created_at ASC";
    db.query(query, (err, results) => {
      if (err) {
        console.error("Error fetching admin affiliates:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.json(results);
    });
  });

// Reorder partners
router.put("/reorder", async (req, res) => {
  const { orderedIds } = req.body; // Expects [1, 5, 2, 3]

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({ message: "Invalid data format" });
  }

  // Iterate and update each
  // Note: For production with many items, a CASE statement is better. For < 50 items, this loop is fine.
  try {
    const promises = orderedIds.map((id, index) => {
        return new Promise((resolve, reject) => {
            db.query("UPDATE affiliate_partners SET sort_order = ? WHERE id = ?", [index, id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    await Promise.all(promises);
    res.json({ message: "Reordered successfully" });

  } catch (err) {
      console.error("Error reordering:", err);
      res.status(500).json({ message: "Database error during reorder" });
  }
});

// Add new affiliate partner
router.post("/", (req, res) => {
  const { platform_name, logo_url, link_template } = req.body;

  if (!platform_name || !link_template) {
    return res.status(400).json({ message: "Platform name and link template are required" });
  }

  const query = "INSERT INTO affiliate_partners (platform_name, logo_url, link_template) VALUES (?, ?, ?)";
  db.query(query, [platform_name, logo_url, link_template], (err, result) => {
    if (err) {
      console.error("Error adding affiliate:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "Affiliate added successfully", id: result.insertId });
  });
});

// Update affiliate partner
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { platform_name, logo_url, link_template, is_active } = req.body;

  const query = `
    UPDATE affiliate_partners 
    SET platform_name = ?, logo_url = ?, link_template = ?, is_active = ? 
    WHERE id = ?`;
  
  db.query(query, [platform_name, logo_url, link_template, is_active, id], (err, result) => {
    if (err) {
      console.error("Error updating affiliate:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "Affiliate updated successfully" });
  });
});

// Delete (or soft delete) affiliate partner
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM affiliate_partners WHERE id = ?";
  
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error deleting affiliate:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "Affiliate deleted successfully" });
  });
});

export default router;
