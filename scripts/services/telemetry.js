class TelemetryService {
  constructor() {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const runningOutsideBackendPort = isLocal && window.location.port && window.location.port !== '3000';
    this.baseUrl = runningOutsideBackendPort ? 'http://localhost:3000/api/telemetry' : '/api/telemetry';
    this.sessionId = this.getOrCreateSessionId();
    this.queue = [];
    this.flushTimer = null;
  }

  get token() {
    return localStorage.getItem('token');
  }

  getOrCreateSessionId() {
    const key = 'telemetry:session-id';
    let value = localStorage.getItem(key);
    if (!value) {
      value = (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
      localStorage.setItem(key, value);
    }
    return value;
  }

  init() {
    window.addEventListener('error', (event) => {
      this.track('ui_error', {
        level: 'error',
        route_or_feature: 'window',
        error_message_short: event.message || 'Unhandled UI error'
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track('ui_error', {
        level: 'error',
        route_or_feature: 'promise',
        error_message_short: String(event.reason || 'Unhandled promise rejection').slice(0, 300)
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush({ useBeacon: true });
      }
    });

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target.closest('button, a, [data-view], [data-testid], [id^="btn-"], [role="button"], [data-telemetry-click]') : null;
        if (!target) return;

        const modal = target.closest('[id$="modal"]');
        const label =
          target.getAttribute('data-telemetry-click') ||
          target.getAttribute('data-testid') ||
          target.getAttribute('id') ||
          target.textContent?.trim()?.slice(0, 80) ||
          target.tagName.toLowerCase();

        const viewId = document.querySelector('[data-active="true"]')?.getAttribute('data-view') || null;

        this.track('ui_click', {
          route_or_feature: viewId || window.location.pathname,
          props: {
            element_label: label,
            element_tag: target.tagName.toLowerCase(),
            element_id: target.getAttribute('id') || null,
            data_view: target.getAttribute('data-view') || null,
            data_testid: target.getAttribute('data-testid') || null,
            modal_id: modal?.id || null
          }
        });
      },
      { capture: true }
    );
  }

  track(eventName, payload = {}) {
    this.queue.push({
      event_name: eventName,
      session_id: this.sessionId,
      source: 'web',
      ...payload
    });

    if (this.queue.length >= 10) {
      this.flush();
      return;
    }

    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), 3000);
  }

  trackView(viewId, durationMs = null) {
    this.track('view_opened', {
      view_id: viewId,
      route_or_feature: viewId,
      props: {
        duration_previous_view_ms: durationMs
      }
    });
  }

  trackError(moduleName, message, code = null) {
    this.track('api_error', {
      level: 'error',
      route_or_feature: moduleName,
      error_code: code,
      error_message_short: String(message || 'Unknown error').slice(0, 300)
    });
  }

  async flush({ useBeacon = false } = {}) {
    if (!this.queue.length) return;
    const events = this.queue.splice(0, this.queue.length);

    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const body = JSON.stringify({ events });

    try {
      if (useBeacon && navigator.sendBeacon && !this.token) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`${this.baseUrl}/events`, blob);
        return;
      }

      await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers,
        body,
        keepalive: Boolean(useBeacon)
      });
    } catch {
      // Telemetry should never break user flow.
    }
  }
}

export const telemetry = new TelemetryService();
