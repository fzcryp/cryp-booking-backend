
import db from './src/config/db.js';

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS discount_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    booking_id VARCHAR(255) NOT NULL,
    file_path VARCHAR(255),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

const run = async () => {
    try {
        await db.promise().query(createTableQuery);
        console.log("✅ Table 'discount_requests' created successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating table:", error);
        process.exit(1);
    }
};

run();
