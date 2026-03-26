export class CreditTransactionsRepository {
  static async findByOperationKeyForUpdateWithClient(client, operationKey) {
    const result = await client.query(
      `SELECT * FROM credit_transactions WHERE operation_key = $1 FOR UPDATE`,
      [operationKey]
    );
    return result.rows[0] || null;
  }

  static async createWithClient(client, { userId, operationKey, amount, status, description }) {
    const result = await client.query(
      `INSERT INTO credit_transactions (user_id, operation_key, amount, status, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, operationKey, amount, status, description || null]
    );
    return result.rows[0];
  }

  static async updateStatusWithClient(client, operationKey, status) {
    const capturedAt = status === 'captured';
    const releasedAt = status === 'released' || status === 'refunded';
    const result = await client.query(
      `UPDATE credit_transactions
       SET status = $2,
           captured_at = CASE WHEN $3 THEN NOW() ELSE captured_at END,
           released_at = CASE WHEN $4 THEN NOW() ELSE released_at END,
           updated_at = NOW()
       WHERE operation_key = $1
       RETURNING *`,
      [operationKey, status, capturedAt, releasedAt]
    );
    return result.rows[0] || null;
  }
}
