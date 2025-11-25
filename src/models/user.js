import db from "../config/db.js";

export const createUser = (name, email, password, callback) => {
  const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
  db.query(sql, [name, email, password], callback);
};

export const findUserByEmail = (email, callback) => {
  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], callback);
};

export const getUserBalance = (email, callback) => {
  const sql = "SELECT balance FROM users WHERE email = ?";
  db.query(sql, [email], callback);
};

/**
 * Deduct balance atomically (prevents negative balance)
 * amount must be positive number (deduct this amount)
 */
export const deductUserBalance = (email, amount, callback) => {
  const sql = `
    UPDATE users
    SET balance = balance - ?
    WHERE email = ? AND balance >= ?
  `;
  db.query(sql, [amount, email, amount], callback);
};

/**
 * Restore (credit) user balance (used when payout fails and we need to rollback)
 */
export const creditUserBalance = (email, amount, callback) => {
  const sql = `
    UPDATE users
    SET balance = balance + ?
    WHERE email = ?
  `;
  db.query(sql, [amount, email], callback);
};
export const updateUserBalance = (email, amount, callback) => {
  const sql = `
    UPDATE users 
    SET balance = balance - ? 
    WHERE email = ? AND balance >= ?`;
  db.query(sql, [amount, email, amount], callback);
};
export const createUserWithReferral = (
  name,
  email,
  password,
  referral_code,
  referrer_id,
  callback
) => {
  const sql = `
    INSERT INTO users (name, email, password, referral_code, referrer_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [name, email, password, referral_code, referrer_id], callback);
};

export const findUserByReferralCode = (referral_code, callback) => {
  const sql = "SELECT * FROM users WHERE referral_code = ?";
  db.query(sql, [referral_code], callback);
};
