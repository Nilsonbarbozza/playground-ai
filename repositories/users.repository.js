import db from '../config/db.js';

export class UsersRepository {
  static async findIdByEmail(email) {
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async findAuthByEmail(email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  static async create(email, passwordHash) {
    const result = await db.query(
      'INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, false) RETURNING id, email, credits, is_verified',
      [email, passwordHash]
    );
    return result.rows[0];
  }

  static async saveOtp(userId, otpCode, expiresAt) {
    await db.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3',
      [otpCode, expiresAt, userId]
    );
  }

  static async verifyOtp(userId, otpCode) {
    const result = await db.query(
      'SELECT id, otp_expires_at FROM users WHERE id = $1 AND otp_code = $2',
      [userId, otpCode]
    );
    if (result.rows.length === 0) return false;

    // Comparar no JS para evitar problemas de Timezone do timezone do Servidor vs Postgres
    const { otp_expires_at } = result.rows[0];
    if (new Date(otp_expires_at) < new Date()) return false;

    await db.query(
      'UPDATE users SET is_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [userId]
    );
    return true;
  }

  static async findProfileById(userId) {
    const result = await db.query(
      'SELECT id, email, credits, created_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  static async findCreditsForUpdateWithClient(client, userId) {
    const result = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [userId]);
    return result.rows[0] || null;
  }

  static async decrementCreditsWithClient(client, userId, amount) {
    await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [amount, userId]);
  }

  static async incrementCreditsWithClient(client, userId, amount) {
    await client.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [amount, userId]);
  }
}
