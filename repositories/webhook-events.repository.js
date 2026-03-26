import db from '../config/db.js';

export class WebhookEventsRepository {
  static async hasEvent(eventId) {
    const result = await db.query(
      `SELECT id FROM webhook_events WHERE provider = $1 AND event_id = $2 LIMIT 1`,
      ['stripe', eventId]
    );
    return result.rows.length > 0;
  }

  static async insertWithClient(client, { eventId, eventType, payload }) {
    await client.query(
      `INSERT INTO webhook_events (provider, event_id, event_type, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['stripe', eventId, eventType, JSON.stringify(payload)]
    );
  }
}
