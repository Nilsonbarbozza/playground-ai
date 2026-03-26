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
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, credits',
      [email, passwordHash]
    );
    return result.rows[0];
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
