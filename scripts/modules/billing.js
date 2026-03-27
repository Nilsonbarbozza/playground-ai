import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

const FIRST_SIGNUP_PROMPT_PREFIX = 'topup:first-signup-shown:';

export const billing = {
  state: {
    open: false,
    loading: false
  },

  init() {
    this.ensureModal();
    this.bindCreditsButton();
    this.bindGlobalAuthEvents();
    this.handleCheckoutReturn();
    console.log('[Billing] Initialized');
  },

  ensureModal() {
    if (document.getElementById('billing-modal')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'billing-modal';
    wrapper.className =
      'tw-fixed tw-inset-0 tw-bg-black/50 tw-z-[9998] tw-hidden tw-items-center tw-justify-center tw-p-4';
    wrapper.innerHTML = `
      <div class="tw-bg-white tw-w-full tw-max-w-lg tw-rounded-2xl tw-shadow-2xl tw-overflow-hidden">
        <div class="tw-flex tw-items-center tw-justify-between tw-p-5 tw-border-b tw-border-gray-100">
          <h3 class="tw-text-lg tw-font-bold tw-text-gray-900">Adicionar Creditos</h3>
          <button id="billing-modal-close" class="tw-w-8 tw-h-8 tw-rounded-lg tw-border tw-border-gray-200 hover:tw-bg-gray-50">x</button>
        </div>
        <div class="tw-p-5 tw-space-y-4">
          <p class="tw-text-sm tw-text-gray-600">Escolha um plano para continuar criando com IA.</p>
          <div id="billing-status" class="tw-hidden tw-text-sm tw-rounded-lg tw-p-3"></div>
          <div id="billing-packages" class="tw-grid tw-gap-3"></div>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const closeBtn = document.getElementById('billing-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    wrapper.addEventListener('click', (e) => {
      if (e.target === wrapper) this.closeModal();
    });
  },

  bindCreditsButton() {
    const btn = document.querySelector('[data-testid="@ai-playground-v2/credits-dropdown"]');
    if (!btn) return;
    btn.addEventListener('click', () => this.openModal());
  },

  bindGlobalAuthEvents() {
    document.addEventListener('auth:login-success', (event) => {
      const detail = event.detail || {};
      const isFirstSignup = Boolean(detail.isFirstSignup);
      const userId = detail.user?.id;
      if (!isFirstSignup || !userId) return;

      const key = `${FIRST_SIGNUP_PROMPT_PREFIX}${userId}`;
      const alreadyShown = localStorage.getItem(key) === '1';
      if (alreadyShown) return;

      localStorage.setItem(key, '1');
      this.openModal({ message: 'Conta criada com sucesso. Escolha um plano para adicionar creditos.' });
    });
  },

  async openModal(options = {}) {
    const modal = document.getElementById('billing-modal');
    if (!modal) return;

    this.state.open = true;
    modal.classList.remove('tw-hidden');
    modal.classList.add('tw-flex');

    if (options.message) {
      this.showStatus(options.message, 'info');
    } else {
      this.hideStatus();
    }

    await this.loadPackages();
  },

  closeModal() {
    const modal = document.getElementById('billing-modal');
    if (!modal) return;
    this.state.open = false;
    modal.classList.remove('tw-flex');
    modal.classList.add('tw-hidden');
  },

  showStatus(message, type = 'info') {
    const status = document.getElementById('billing-status');
    if (!status) return;

    status.classList.remove('tw-hidden', 'tw-bg-red-50', 'tw-text-red-700', 'tw-bg-green-50', 'tw-text-green-700', 'tw-bg-blue-50', 'tw-text-blue-700');
    if (type === 'error') status.classList.add('tw-bg-red-50', 'tw-text-red-700');
    else if (type === 'success') status.classList.add('tw-bg-green-50', 'tw-text-green-700');
    else status.classList.add('tw-bg-blue-50', 'tw-text-blue-700');

    status.textContent = message;
  },

  hideStatus() {
    const status = document.getElementById('billing-status');
    if (!status) return;
    status.classList.add('tw-hidden');
    status.textContent = '';
  },

  async loadPackages() {
    const root = document.getElementById('billing-packages');
    if (!root) return;

    root.innerHTML = '<div class="tw-text-sm tw-text-gray-500">Carregando planos...</div>';

    try {
      const data = await api.get('/billing/packages');
      const packages = data.packages || [];
      if (!packages.length) {
        root.innerHTML = '<div class="tw-text-sm tw-text-gray-500">Nenhum plano disponivel no momento.</div>';
        return;
      }

      root.innerHTML = packages
        .map(
          (pkg) => `
          <button class="billing-package-btn tw-w-full tw-text-left tw-border tw-border-gray-200 hover:tw-border-black tw-rounded-xl tw-p-4 tw-transition" data-package-id="${pkg.id}">
            <div class="tw-flex tw-items-center tw-justify-between">
              <div>
                <p class="tw-font-semibold tw-text-gray-900">${pkg.name}</p>
                <p class="tw-text-xs tw-text-gray-500">${pkg.credits} creditos</p>
              </div>
              <p class="tw-text-base tw-font-bold tw-text-gray-900">R$ ${(pkg.price_brl_cents / 100).toFixed(2).replace('.', ',')}</p>
            </div>
          </button>
        `
        )
        .join('');

      root.querySelectorAll('.billing-package-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.startCheckout(btn.getAttribute('data-package-id')));
      });
    } catch (err) {
      root.innerHTML = '<div class="tw-text-sm tw-text-red-600">Erro ao carregar planos.</div>';
      this.showStatus(err.message, 'error');
    }
  },

  async startCheckout(packageId) {
    if (!packageId || this.state.loading) return;
    this.state.loading = true;
    this.showStatus('Criando checkout...', 'info');

    try {
      const data = await api.post('/billing/checkout-session', { package_id: packageId });
      if (!data.checkout_url) throw new Error('Checkout URL nao retornada.');
      window.location.href = data.checkout_url;
    } catch (err) {
      this.showStatus(err.message, 'error');
      this.state.loading = false;
    }
  },

  handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');
    const orderId = params.get('order_id');
    if (!checkoutState || !orderId) return;

    if (checkoutState === 'cancel') {
      this.openModal({ message: 'Pagamento cancelado. Escolha um plano para tentar novamente.' });
      this.cleanupCheckoutParams();
      return;
    }

    if (checkoutState === 'success') {
      this.openModal({ message: 'Pagamento recebido. Validando confirmacao...' });
      this.pollOrderStatus(orderId);
      this.cleanupCheckoutParams();
    }
  },

  cleanupCheckoutParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('order_id');
    window.history.replaceState({}, '', url.toString());
  },

  async pollOrderStatus(orderId) {
    const start = Date.now();
    const timeoutMs = 2 * 60 * 1000;

    while (Date.now() - start < timeoutMs) {
      try {
        const data = await api.get(`/billing/orders/${orderId}`);
        const status = data?.order?.status;

        if (status === 'paid') {
          this.showStatus('Pagamento confirmado. Creditos atualizados!', 'success');
          await auth.refreshUser();
          return;
        }

        if (status === 'failed' || status === 'expired') {
          this.showStatus(`Pagamento ${status}. Tente novamente.`, 'error');
          return;
        }

        this.showStatus('Aguardando confirmacao do pagamento...', 'info');
      } catch (err) {
        this.showStatus(`Erro ao validar pedido: ${err.message}`, 'error');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    this.showStatus('Confirmacao demorou mais do que o esperado. Reabra o modal para atualizar.', 'error');
  }
};
