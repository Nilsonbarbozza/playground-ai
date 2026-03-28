import { TelemetryEventsRepository } from '../../repositories/telemetry-events.repository.js';

function sanitizeString(value, max = 255) {
  if (typeof value !== 'string') return null;
  return value.slice(0, max);
}

function sanitizeEvent(input, userId) {
  const eventName = sanitizeString(input.event_name || input.name, 120);
  if (!eventName) return null;

  const props = input.props && typeof input.props === 'object' ? input.props : {};

  return {
    event_name: eventName,
    user_id: userId || null,
    session_id: sanitizeString(input.session_id || props.session_id, 120),
    view_id: sanitizeString(input.view_id || props.view_id, 120),
    route_or_feature: sanitizeString(input.route_or_feature || props.route_or_feature, 180),
    level: sanitizeString(input.level || props.level, 40),
    error_code: sanitizeString(input.error_code || props.error_code, 120),
    error_message_short: sanitizeString(input.error_message_short || props.error_message_short, 350),
    source: sanitizeString(input.source || 'web', 40),
    props
  };
}

export class TelemetryService {
  static async ingest({ body, userId }) {
    const inputEvents = Array.isArray(body?.events)
      ? body.events
      : body
      ? [body]
      : [];

    const sanitized = inputEvents
      .map((event) => sanitizeEvent(event, userId))
      .filter(Boolean)
      .slice(0, 100);

    if (!sanitized.length) {
      return { accepted: 0 };
    }

    const accepted = await TelemetryEventsRepository.insertMany(sanitized);
    return { accepted };
  }
}
