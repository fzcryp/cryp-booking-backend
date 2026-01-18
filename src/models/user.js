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

// ✅ Credit Balance by ID
export const creditUserBalanceById = (id, amount, callback) => {
  const sql = "UPDATE users SET balance = balance + ? WHERE id = ?";
  db.query(sql, [amount, id], callback);
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

// ✅ ADMIN: Get All Users
export const getAllUsers = (callback) => {
  const sql = "SELECT id, name, email, referral_code, balance, isAdmin FROM users ORDER BY id DESC";
  db.query(sql, callback);
};

// ✅ ADMIN: Update User
export const updateUser = (id, data, callback) => {
  const sql = "UPDATE users SET name = ?, email = ?, isAdmin = ? WHERE id = ?";
  db.query(sql, [data.name, data.email, data.isAdmin, id], callback);
};

// ✅ ADMIN: Delete User (Cascade)
export const deleteUser = (id, callback) => {
  // 1. Delete Discount Requests
  db.query("DELETE FROM discount_requests WHERE user_id = ?", [id], (err) => {
    if (err) return callback(err);

    // 2. Delete Referral Rewards (referrer)
    db.query("DELETE FROM referral_rewards WHERE referrer_id = ? OR referred_user_id = ?", [id, id], (err) => {
        if (err) return callback(err);

        // 3. Finally Delete User
        db.query("DELETE FROM users WHERE id = ?", [id], callback);
    });
  });
};

// ✅ ADMIN: Bulk Delete Users (Cascade)
export const deleteUsers = (ids, callback) => {
  if (ids.length === 0) return callback(null, { affectedRows: 0 });

  // 1. Delete Discount Requests
  db.query(`DELETE FROM discount_requests WHERE user_id IN (?)`, [ids], (err) => {
    if (err) return callback(err);

    // 2. Delete Referral Rewards
    db.query(`DELETE FROM referral_rewards WHERE referrer_id IN (?) OR referred_user_id IN (?)`, [ids, ids], (err) => {
        if (err) return callback(err);

        // 3. Finally Delete Users
        db.query(`DELETE FROM users WHERE id IN (?)`, [ids], callback);
    });
  });
};
