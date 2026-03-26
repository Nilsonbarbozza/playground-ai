import db from '../config/db.js';

export class CreditOrdersRepository {
  static async createPending({ userId, packageId, credits, amountBrlCents, currency, idempotencyKey }) {
    const result = await db.query(
      `INSERT INTO credit_orders (
         user_id, package_id, credits, amount_brl_cents, currency, status, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, packageId, credits, amountBrlCents, currency, 'pending', idempotencyKey]
    );
    return result.rows[0];
  }

  static async attachCheckoutSession(orderId, checkoutSessionId) {
    const result = await db.query(
      `UPDATE credit_orders
       SET stripe_checkout_session_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, checkoutSessionId]
    );
    return result.rows[0] || null;
  }

  static async findByIdAndUser(orderId, userId) {
    const result = await db.query(
      `SELECT *
       FROM credit_orders
       WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    return result.rows[0] || null;
  }

  static async findByIdForUpdateWithClient(client, orderId) {
    const result = await client.query(
      `SELECT *
       FROM credit_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );
    return result.rows[0] || null;
  }

  static async updateStatusWithClient(
    client,
    orderId,
    { status, checkoutSessionId = null, paymentIntentId = null, paidAt = false }
  ) {
    const result = await client.query(
      `UPDATE credit_orders
       SET status = $2,
           stripe_checkout_session_id = COALESCE($3, stripe_checkout_session_id),
           stripe_payment_intent_id = COALESCE($4, stripe_payment_intent_id),
           paid_at = CASE WHEN $5 THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orderId, status, checkoutSessionId, paymentIntentId, paidAt]
    );
    return result.rows[0] || null;
  }
}
