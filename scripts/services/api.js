/**
 * API Service - Single Client for AI Playground
 * Handles authentication headers, error management, and response parsing.
 */
class ApiService {
  constructor() {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const runningOutsideBackendPort = isLocal && window.location.port && window.location.port !== '3000';
    this.baseUrl = runningOutsideBackendPort ? 'http://localhost:3000/api' : '/api';
  }

  get token() {
    return localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Add Authorization if token exists
    const headers = {
      ...(options.headers || {})
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      
      // Handle Unauthorized (Token expired/invalid)
      if (response.status === 401) {
        document.dispatchEvent(new CustomEvent('auth:required'));
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn(`[API_WARN] Expected JSON but received: ${text.substring(0, 100)}...`);
        throw new Error(`Resposta não-JSON do servidor (Status ${response.status}). Verifique o console.`);
      }

      if (!response.ok) throw new Error(data.error || 'Erro na requisição.');
      
      return data;
    } catch (err) {
      console.error(`[API_ERR] ${endpoint}:`, err.message);
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
