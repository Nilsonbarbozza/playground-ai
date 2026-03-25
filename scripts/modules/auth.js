import { api } from '../services/api.js';
import { ui } from './ui.js';
import { navigation } from './navigation.js';

/**
 * Authentication Module
 * Handles Login, Register, Logout and Session Initial State.
 */
export const auth = {
  user: null,

  init() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
        this.updateUI();
      } catch (e) {
        localStorage.removeItem('user');
      }
    } else {
      this.updateUI(); // Ensure auth-section shows if no user
    }
    this.initListeners();
    document.addEventListener('auth:required', () => this.showModal(true));
    console.log('[Auth] Initialized');
  },

  updateUI() {
    const authSect = document.getElementById('auth-section');
    const profSect = document.getElementById('profile-section');
    const userEmail = document.getElementById('user-email');

    if (this.user) {
      if (userEmail) userEmail.textContent = this.user.email;
      ui.updateCreditsDisplay(this.user.credits || 0);
      if (authSect) authSect.classList.add('tw-hidden');
      if (profSect) profSect.classList.remove('tw-hidden');
      this.showModal(false);
    } else {
      if (authSect) authSect.classList.remove('tw-hidden');
      if (profSect) profSect.classList.add('tw-hidden');
    }
  },

  showModal(show = true) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      if (show) modal.classList.remove('tw-hidden');
      else modal.classList.add('tw-hidden');
    }
  },

  initListeners() {
    // Modal controls
    const btnOpen = document.getElementById('btn-open-login');
    if (btnOpen) btnOpen.onclick = () => this.showModal(true);

    const btnClose = document.getElementById('btn-close-auth');
    if (btnClose) btnClose.onclick = () => this.showModal(false);

    // Form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        
        try {
          ui.setLoading('btn-login', true, 'Entrando...');
          const data = await api.post('/auth/login', { email, password });
          this.handleSuccess(data);
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          ui.setLoading('btn-login', false);
        }
      };
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.onclick = () => {
      localStorage.clear();
      window.location.reload();
    };
  },

  handleSuccess(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    this.user = data.user;
    this.updateUI();
    ui.showToast('Bem-vindo de volta!');
    navigation.switchView('view-text-to-image');
    this.showModal(false);
  }
};

