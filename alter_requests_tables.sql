-- Add request_id to discount_requests
ALTER TABLE discount_requests 
ADD COLUMN request_id VARCHAR(50) UNIQUE AFTER id;

-- Add ticket_id to support_requests
ALTER TABLE support_requests
ADD COLUMN ticket_id VARCHAR(50) UNIQUE AFTER id;
