import db from '../config/db.js';

export class CreditPackagesRepository {
  static async listActive() {
    const result = await db.query(
      `SELECT id, code, name, price_brl_cents, credits, active, stripe_price_id, created_at
       FROM credit_packages
       WHERE active = true
       ORDER BY price_brl_cents ASC`
    );
    return result.rows;
  }

  static async findActiveById(packageId) {
    const result = await db.query(
      `SELECT id, code, name, price_brl_cents, credits, active, stripe_price_id
       FROM credit_packages
       WHERE id = $1 AND active = true`,
      [packageId]
    );
    return result.rows[0] || null;
  }
}
