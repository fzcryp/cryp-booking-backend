import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// POST /api/subscribe
router.post('/', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    try {
        // Check if already subscribed
        const checkQuery = 'SELECT * FROM subscribers WHERE email = ?';
        db.query(checkQuery, [email], (err, results) => {
            if (err) {
                console.error('Error checking subscriber:', err);
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length > 0) {
                return res.status(409).json({ message: 'Email already subscribed' });
            }

            // Insert new subscriber
            const insertQuery = 'INSERT INTO subscribers (email) VALUES (?)';
            db.query(insertQuery, [email], (err, result) => {
                if (err) {
                    console.error('Error adding subscriber:', err);
                    return res.status(500).json({ message: 'Database error' });
                }

                return res.status(201).json({ message: 'Successfully subscribed to newsletter!' });
            });
        });

    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// GET /api/subscribe - List all subscribers
router.get('/', (req, res) => {
    const query = 'SELECT * FROM subscribers ORDER BY subscribed_at DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching subscribers:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(results);
    });
});

// PUT /api/subscribe/:id/status - Toggle active status
router.put('/:id/status', (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body; // Expect boolean

    const query = 'UPDATE subscribers SET is_active = ? WHERE id = ?';
    db.query(query, [is_active, id], (err, result) => {
        if (err) {
            console.error('Error updating subscriber status:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Subscriber status updated' });
    });
});

// DELETE /api/subscribe/:id - Remove subscriber
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM subscribers WHERE id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error deleting subscriber:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Subscriber deleted successfully' });
    });
});

export default router;
