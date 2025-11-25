import db from "../config/db.js";

/**
 * Generic saveTransaction (keeps existing behavior)
 */
export const saveTransaction = (transaction, callback) => {
  const sql = `
    INSERT INTO transactions
      (transaction_id, payer_name, amount, currency, status, date, user_email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    transaction.transactionId,
    transaction.payerName,
    transaction.amount,
    transaction.currency,
    transaction.status,
    transaction.date,
    transaction.user_email,
  ];

  db.query(sql, values, callback);
};

/**
 * Save a withdrawal transaction with full breakdown (fees, final payment, payout id)
 */
export const saveWithdrawalTransaction = (tx, callback) => {
  const sql = `
    INSERT INTO transactions
      (transaction_id, payer_name, amount, amount_requested, currency, status, date, user_email,
       type, paypal_fee, platform_fee, total_fee, final_amount, paypal_payout_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    tx.transaction_id || tx.transactionId || null,
    tx.payer_name || tx.payerName || null,
    tx.amount || tx.amount, // legacy amount if any
    tx.amount_requested, // requested amount
    tx.currency || tx.currency_code || "USD",
    tx.status || "PENDING",
    tx.date || new Date().toISOString(),
    tx.user_email,
    tx.type || "WITHDRAWAL",
    tx.paypal_fee || 0.0,
    tx.platform_fee || 0.0,
    tx.total_fee || 0.0,
    tx.final_amount || 0.0,
    tx.paypal_payout_id || null,
    tx.notes || null,
  ];

  db.query(sql, values, callback);
};

export const getTransactionsByUser = (user_email, callback) => {
  const sql =
    "SELECT * FROM transactions WHERE user_email = ? ORDER BY id DESC";
  db.query(sql, [user_email], callback);
};
