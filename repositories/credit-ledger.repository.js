export class CreditLedgerRepository {
  static async addWithClient(client, { userId, amount, description }) {
    await client.query('INSERT INTO credit_ledger (user_id, amount, description) VALUES ($1, $2, $3)', [
      userId,
      amount,
      description
    ]);
  }
}
