import db from "../config/db.js";

// Save a hotel
export const saveHotel = (user_email, hotel_id, hotel_name, hotel_data, callback) => {
  const sql = "INSERT INTO saved_hotels (user_email, hotel_id, hotel_name, hotel_data) VALUES (?, ?, ?, ?)";
  db.query(sql, [user_email, hotel_id, hotel_name, JSON.stringify(hotel_data)], callback);
};

// Remove a saved hotel
export const removeHotel = (user_email, hotel_id, callback) => {
  const sql = "DELETE FROM saved_hotels WHERE user_email = ? AND hotel_id = ?";
  db.query(sql, [user_email, hotel_id], callback);
};

// Get all saved hotels for a user
export const getSavedHotels = (user_email, callback) => {
  const sql = "SELECT * FROM saved_hotels WHERE user_email = ? ORDER BY created_at DESC";
  db.query(sql, [user_email], callback);
};

// Check if a hotel is saved
export const isHotelSaved = (user_email, hotel_id, callback) => {
    const sql = "SELECT count(*) as count FROM saved_hotels WHERE user_email = ? AND hotel_id = ?";
    db.query(sql, [user_email, hotel_id], callback);
}
