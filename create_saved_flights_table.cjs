const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crypbooking'
});

const createSavedFlightsTable = `
CREATE TABLE IF NOT EXISTS saved_flights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    flight_id VARCHAR(255) NOT NULL,
    flight_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_flight (user_email, flight_id)
)`;

db.connect(err => {
    if (err) throw err;
    console.log("Connected to DB");
    db.query(createSavedFlightsTable, (err, result) => {
        if (err) {
            console.error('Error creating saved_flights table:', err);
        } else {
            console.log('saved_flights table created or already exists');
        }
        process.exit();
    });
});
