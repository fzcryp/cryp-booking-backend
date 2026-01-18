import db from './src/config/db.js';

const createContactUsTable = `
CREATE TABLE IF NOT EXISTS contact_us (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

db.query(createContactUsTable, (err, result) => {
    if (err) {
        console.error('Error creating contact_us table:', err);
    } else {
        console.log('contact_us table created or already exists');
    }
    process.exit();
});
