/**
 * API Service - Single Client for AI Playground
 * Handles authentication headers, error management, and response parsing.
 */
import { telemetry } from './telemetry.js';

class ApiService {
  constructor() {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isFileProtocol = window.location.protocol === 'file:';
    const runningOutsideBackendPort = isLocalHost && window.location.port && window.location.port !== '3000';

    this.baseUrl = (runningOutsideBackendPort || isFileProtocol) ? 'http://localhost:3000/api' : '/api';
    this.fallbackBaseUrl = this.baseUrl === '/api' ? 'http://localhost:3000/api' : '/api';
  }

  get token() {
    return localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    return this.requestWithBase(endpoint, options, this.baseUrl, true);
  }

  async requestWithBase(endpoint, options, baseUrl, allowFallback) {
    const url = `${baseUrl}${endpoint}`;

    // Add Authorization if token exists
    const headers = {
      ...(options.headers || {})
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Fallback for local/dev host mismatch (common source of 404)
      if (response.status === 404 && allowFallback) {
        const canFallback = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
        if (canFallback) {
          console.warn(`[API_WARN] 404 em ${url}. Tentando fallback ${this.fallbackBaseUrl}${endpoint}`);
          return this.requestWithBase(endpoint, options, this.fallbackBaseUrl, false);
        }
      }

      // Handle Unauthorized (Token expired/invalid)
      if (response.status === 401) {
        document.dispatchEvent(new CustomEvent('auth:required'));
        throw new Error('Sessao expirada. Faca login novamente.');
      }

      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn(`[API_WARN] Expected JSON but received: ${text.substring(0, 100)}...`);
        throw new Error(`Resposta nao-JSON do servidor (Status ${response.status}). Verifique o console.`);
      }

      if (!response.ok) throw new Error(data.error || 'Erro na requisicao.');

      return data;
    } catch (err) {
      console.error(`[API_ERR] ${endpoint}:`, err.message);
      telemetry.trackError('api.request', `${endpoint}: ${err.message}`);
      throw err;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, body, isFormData = false) {
    const options = { method: 'POST' };

    if (isFormData) {
      options.body = body; // Body is already FormData
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    return this.request(endpoint, options);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
}

export const api = new ApiService();

