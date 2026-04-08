import { api } from '../services/api.js';
import { ui } from './ui.js';
import { navigation } from './navigation.js';
import { telemetry } from '../services/telemetry.js';

/**
 * Authentication Module
 * Handles Login, Register, Logout and Session Initial State.
 */
export const auth = {
  user: null,
  pendingUserId: null,

  init() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
        this.updateUI();
      } catch {
        localStorage.removeItem('user');
      }
    } else {
      this.updateUI();
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
    if (!modal) return;
    if (show) modal.classList.remove('tw-hidden');
    else modal.classList.add('tw-hidden');
  },

  initListeners() {
    const btnOpen = document.getElementById('btn-open-login');
    if (btnOpen) btnOpen.onclick = () => this.showModal(true);

    const btnClose = document.getElementById('btn-close-auth');
    if (btnClose) btnClose.onclick = () => this.showModal(false);

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;

        try {
          ui.setLoading('btn-login', true, 'Entrando...');
          const data = await api.post('/auth/login', { email, password });
          this.handleSuccess(data, false);
        } catch (err) {
          // If error is 403 and requires_verification, show OTP
          if (err.requires_verification && err.user) {
            this.pendingUserId = err.user.id;
            this.showOtpForm();
            ui.showToast(err.message || 'Verifique seu e-mail.', 'info');
          } else {
            ui.showToast(err.message, 'error');
          }
        } finally {
          ui.setLoading('btn-login', false);
        }
      };
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        const confirmPassword = e.target.confirmPassword.value;

        if (password !== confirmPassword) {
          ui.showToast('As senhas nao coincidem.', 'error');
          return;
        }
        if (password.length < 6) {
          ui.showToast('A senha deve ter no minimo 6 caracteres.', 'error');
          return;
        }

        try {
          ui.setLoading('btn-register', true, 'Criando conta...');
          const data = await api.post('/auth/register', { email, password });
          if (data.requires_verification && data.user) {
            this.pendingUserId = data.user.id;
            this.showOtpForm();
            ui.showToast(data.message || 'Verifique seu e-mail.', 'success');
          } else {
            this.handleSuccess(data, true);
          }
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          ui.setLoading('btn-register', false);
        }
      };
    }

    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
      otpForm.onsubmit = async (e) => {
        e.preventDefault();
        const otpCode = e.target.otpCode.value;
        if (!this.pendingUserId) return;

        try {
          ui.setLoading('btn-verify-otp', true, 'Verificando...');
          const data = await api.post('/auth/verify-otp', { userId: this.pendingUserId, otpCode });
          this.handleSuccess(data, true);
        } catch (err) {
          ui.showToast(err.message, 'error');
        } finally {
          ui.setLoading('btn-verify-otp', false);
        }
      };
    }

    const btnBackToLogin = document.getElementById('btn-back-to-login');
    if (btnBackToLogin) {
      btnBackToLogin.onclick = () => {
        document.getElementById('otp-form').classList.add('tw-hidden');
        document.getElementById('login-form').classList.remove('tw-hidden');
        document.getElementById('auth-modal-title').textContent='Bem-vindo de volta';
        document.getElementById('auth-modal-subtitle').textContent='Faça login para continuar criando';
      };
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        localStorage.clear();
        window.location.reload();
      };
    }
  },

  handleSuccess(data, isNewUser = false) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    this.user = data.user;
    this.updateUI();

    const isFirstSignup = Boolean(data.is_first_signup) || Boolean(isNewUser);
    telemetry.track(isFirstSignup ? 'auth_register_success' : 'auth_login_success', {
      route_or_feature: 'auth',
      props: { user_id: data.user?.id || null }
    });
    telemetry.flush();
    
    if (isFirstSignup) {
      this.showWelcomeModal('Boas Vindas!', 'Obrigado pelo cadastro, use nossos motores de AI a vontade.');
    } else {
      this.showWelcomeModal('Sucesso!', 'Seja bem-vindo de volta!');
    }

    document.dispatchEvent(
      new CustomEvent('auth:login-success', {
        detail: {
          user: data.user,
          isFirstSignup
        }
      })
    );

    navigation.switchView('view-text-to-image');
    this.showModal(false);
  },

  async refreshUser() {
    try {
      const data = await api.get('/user/me');
      if (!data.success) return;
      this.user = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
      this.updateUI();
      console.log('[Auth] Credits refreshed:', data.user.credits);
    } catch (err) {
      console.error('[Auth] Failed to refresh user:', err.message);
    }
  },

  showWelcomeModal(title, message) {
    const modal = document.getElementById('welcome-modal');
    const content = document.getElementById('welcome-modal-content');
    if (!modal || !content) return;
    
    document.getElementById('welcome-modal-title').textContent = title;
    document.getElementById('welcome-modal-text').textContent = message;
    
    modal.classList.remove('tw-opacity-0', 'tw-pointer-events-none');
    modal.classList.add('tw-opacity-100', 'tw-pointer-events-auto');
    content.classList.remove('tw-scale-95');
    content.classList.add('tw-scale-100');

    setTimeout(() => {
      modal.classList.remove('tw-opacity-100', 'tw-pointer-events-auto');
      modal.classList.add('tw-opacity-0', 'tw-pointer-events-none');
      content.classList.remove('tw-scale-100');
      content.classList.add('tw-scale-95');
    }, 3000);
  },

  showOtpForm() {
    document.getElementById('login-form').classList.add('tw-hidden');
    document.getElementById('register-form').classList.add('tw-hidden');
    document.getElementById('otp-form').classList.remove('tw-hidden');
    
    document.getElementById('auth-modal-title').textContent = 'Código de Acesso';
    document.getElementById('auth-modal-subtitle').textContent = 'Digite o código para validar sua conta';
    document.querySelector('.tw-flex.tw-mb-6.tw-bg-gray-100')?.classList.add('tw-hidden'); // hide tabs
  }
};
