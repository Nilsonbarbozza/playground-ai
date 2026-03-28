import db from '../config/db.js';

export class TelemetryEventsRepository {
  static async insertMany(events) {
    if (!events.length) return 0;

    const values = [];
    const placeholders = events.map((event, index) => {
      const offset = index * 10;
      values.push(
        event.event_name,
        event.user_id,
        event.session_id,
        event.view_id,
        event.route_or_feature,
        event.level,
        event.error_code,
        event.error_message_short,
        event.source || 'web',
        JSON.stringify(event.props || {})
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}::jsonb)`;
    });

    await db.query(
      `INSERT INTO telemetry_events (
         event_name,
         user_id,
         session_id,
         view_id,
         route_or_feature,
         level,
         error_code,
         error_message_short,
         source,
         props
       ) VALUES ${placeholders.join(', ')}`,
      values
    );

    return events.length;
  }
}
