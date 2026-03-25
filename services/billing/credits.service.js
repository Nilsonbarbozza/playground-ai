import db from '../../config/db.js';

/**
 * Billing Service - Professional Grade
 * Handles transactional credit operations with row locking and audit logging.
 */
export class CreditService {
  /**
   * Deduct credits atomically within a transaction
   * @param {number} userId 
   * @param {number} amount 
   * @param {string} description 
   */
  static async useCredits(userId, amount, description) {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Lock the user row to prevent concurrent deductions (ACID)
      const userRes = await client.query(
        'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userRes.rows.length === 0) throw new Error('User not found.');
      
      const currentCredits = userRes.rows[0].credits;
      if (currentCredits < amount) {
        throw new Error('Saldo insuficiente para esta operação.');
      }

      // 2. Perform the deduction
      await client.query(
        'UPDATE users SET credits = credits - $1 WHERE id = $2',
        [amount, userId]
      );

      // 3. Log to ledger for audit
      await client.query(
        'INSERT INTO credit_ledger (user_id, amount, description) VALUES ($1, $2, $3)',
        [userId, -amount, description]
      );

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Refund credits if an AI operation fails
   */
  static async refundCredits(userId, amount, description) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(
        'UPDATE users SET credits = credits + $1 WHERE id = $2',
        [amount, userId]
      );

      await client.query(
        'INSERT INTO credit_ledger (user_id, amount, description) VALUES ($1, $2, $3)',
        [userId, amount, `REFUND: ${description}`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Billing] Refund failed:', err.message);
    } finally {
      client.release();
    }
  }
}
