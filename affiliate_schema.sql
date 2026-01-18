CREATE TABLE IF NOT EXISTS affiliate_partners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    platform_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    link_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
