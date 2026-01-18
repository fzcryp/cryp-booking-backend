import express from "express";
import db from "../config/db.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Helper: Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// 1. Submit Support Request (User)
router.post("/", (req, res) => {
    const { userId, subject, message } = req.body;

    if (!userId || !subject || !message) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Generate Unique Ticket ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `#SPT-${Date.now().toString().slice(-6)}${randomSuffix}`;

    const sql = "INSERT INTO support_requests (ticket_id, user_id, subject, message) VALUES (?, ?, ?, ?)";
    db.query(sql, [ticketId, userId, subject, message], (err, result) => {
        if (err) {
            console.error("❌ Error submitting support request:", err);
            return res.status(500).json({ error: "Database error" });
        }

        // --- NEW: Send Email Notification to Owner ---
        // Fetch User Details first
        const userSql = "SELECT name, email FROM users WHERE id = ?";
        db.query(userSql, [userId], (uErr, uResults) => {
            if (!uErr && uResults.length > 0) {
                const user = uResults[0];
                const ownerEmail = 'vhemdip@gmail.com';

                const mailOptions = {
                    from: `"Pbookings Support" <${process.env.EMAIL_USER}>`,
                    to: ownerEmail,
                    subject: `New Support Request: ${subject} (${ticketId})`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                            <h2 style="color: #0070ba;">New Support Ticket</h2>
                            <p><strong>Ticket ID:</strong> ${ticketId}</p>
                            <hr>
                            <p><strong>User:</strong> ${user.name}</p>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Subject:</strong> ${subject}</p>
                            <hr>
                            <h3>Message:</h3>
                            <p style="background: #f9f9f9; padding: 15px; border-radius: 5px;">${message}</p>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error("❌ Error sending support email:", error);
                    } else {
                        console.log("✅ Support email sent:", info.response);
                    }
                });
            }
        });

        res.json({ message: "Support request submitted successfully", id: result.insertId, ticketId });
    });
});

// 2. Get User's Request History
router.get("/user/:userId", (req, res) => {
    const { userId } = req.params;
    const sql = "SELECT * FROM support_requests WHERE user_id = ? ORDER BY created_at DESC";

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("❌ Error fetching support history:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 3. (Admin) Get All Requests with User Info
router.get("/admin/all", (req, res) => {
    const sql = `
        SELECT sr.*, u.name as user_name, u.email as user_email 
        FROM support_requests sr
        JOIN users u ON sr.user_id = u.id
        ORDER BY 
            CASE WHEN sr.status = 'Open' THEN 1 ELSE 2 END, 
            sr.created_at DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching all support requests:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 4. (Admin) Reply to Request
router.patch("/admin/:id/reply", (req, res) => {
    const { id } = req.params;
    const { adminReply } = req.body;

    if (!adminReply) {
        return res.status(400).json({ error: "Reply message is required" });
    }

    const sql = "UPDATE support_requests SET admin_reply = ?, status = 'Replied' WHERE id = ?";
    db.query(sql, [adminReply, id], (err, result) => {
        if (err) {
            console.error("❌ Error replying to support request:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "Reply sent successfully" });
    });
});

export default router;
