import { createHash } from 'crypto';
import { TelemetryEventsRepository } from '../../repositories/telemetry-events.repository.js';

function hashParams(params) {
  try {
    const raw = JSON.stringify(params || {});
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function clean(value, max = 200) {
  if (value == null) return null;
  return String(value).slice(0, max);
}

export class TelemetryInternalService {
  static async trackProviderCall({
    userId = null,
    module = null,
    provider = null,
    model = null,
    operation = null,
    status = 'success',
    latencyMs = null,
    attempts = 1,
    params = null,
    errorCode = null,
    errorMessage = null
  } = {}) {
    try {
      const paramsHash = hashParams(params);
      await TelemetryEventsRepository.insertMany([
        {
          event_name: status === 'success' ? 'provider_call_success' : 'provider_call_error',
          user_id: userId || null,
          session_id: null,
          view_id: null,
          route_or_feature: module || 'ai-provider',
          level: status === 'success' ? 'info' : 'error',
          error_code: clean(errorCode, 120),
          error_message_short: clean(errorMessage, 350),
          source: 'backend',
          props: {
            provider: clean(provider, 60),
            model: clean(model, 80),
            operation: clean(operation, 80),
            status,
            latency_ms: Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : null,
            attempts: Number.isFinite(Number(attempts)) ? Number(attempts) : 1,
            params_hash: paramsHash
          }
        }
      ]);
    } catch {
      // Never block the core request flow due to telemetry internals.
    }
  }
}
