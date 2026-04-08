import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';
import { telemetry } from '../services/telemetry.js';

const FIRST_SIGNUP_PROMPT_PREFIX = 'topup:first-signup-shown:';
const TOPUP_AB_VARIANT_KEY = 'topup:ab-variant';
const TOPUP_EXPERIMENT_KEY = 'topup_modal_v1';
const DEFAULT_TOPUP_EXPERIMENT_CONFIG = {
  experiment_key: TOPUP_EXPERIMENT_KEY,
  allocation: { A: 50, B: 50 },
  variants: {
    A: {
      modal_title: 'Adicionar Creditos',
      primary_cta: 'Pagar',
      starter_badge: 'Uso Profissional',
      starter_subtitle: 'Ferramentas avancadas para produtividade.'
    },
    B: {
      modal_title: 'Desbloquear Creditos',
      primary_cta: 'Garantir Creditos Agora',
      starter_badge: 'Oferta Recomendavel',
      starter_subtitle: 'Acesse recursos premium com mais velocidade.'
    }
  }
};

export const billing = {
  state: {
    open: false,
    loading: false,
    abVariant: null,
    experimentConfig: DEFAULT_TOPUP_EXPERIMENT_CONFIG
  },

  init() {
    this.state.abVariant = this.getOrCreateAbVariant();
    this.ensureModal();
    this.bindCreditsButton();
    this.bindGlobalAuthEvents();
    this.handleCheckoutReturn();
    this.loadExperimentConfig();
    console.log('[Billing] Initialized');
  },

  getOrCreateAbVariant() {
    const key = `${TOPUP_AB_VARIANT_KEY}:${this.state.experimentConfig?.experiment_key || TOPUP_EXPERIMENT_KEY}`;
    const existing = localStorage.getItem(key);
    if (existing === 'A' || existing === 'B') return existing;

    const allocationA = Number(this.state.experimentConfig?.allocation?.A ?? 50);
    const threshold = Math.min(Math.max(allocationA, 0), 100) / 100;
    const variant = Math.random() < threshold ? 'A' : 'B';
    localStorage.setItem(key, variant);
    return variant;
  },

  async loadExperimentConfig() {
    try {
      const data = await api.get('/billing/topup-modal-config');
      if (data?.config?.variants?.A && data?.config?.variants?.B) {
        this.state.experimentConfig = data.config;
      }
    } catch {
      // Keep local default config; never block billing flow.
    }
    this.state.abVariant = this.getOrCreateAbVariant();
    this.applyVariantUi();
  },

  withAbVariant(extra = {}) {
    return {
      experiment_key: this.state.experimentConfig?.experiment_key || TOPUP_EXPERIMENT_KEY,
      ab_variant: this.state.abVariant || 'A',
      ...extra
    };
  },

  applyVariantUi() {
    const title = document.getElementById('billing-modal-title');
    const badge = document.getElementById('billing-starter-badge');
    const subtitle = document.getElementById('billing-starter-subtitle');
    const checkoutBtn = document.getElementById('btn-starter-checkout');
    const variantKey = this.state.abVariant === 'B' ? 'B' : 'A';
    const variant = this.state.experimentConfig?.variants?.[variantKey] || DEFAULT_TOPUP_EXPERIMENT_CONFIG.variants[variantKey];
    if (title) title.textContent = variant.modal_title;
    if (badge) badge.textContent = variant.starter_badge;
    if (subtitle) subtitle.textContent = variant.starter_subtitle;
    if (checkoutBtn) checkoutBtn.textContent = variant.primary_cta;
  },

  ensureModal() {
    if (document.getElementById('billing-modal')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'billing-modal';
    wrapper.className =
      'tw-fixed tw-inset-0 tw-bg-black/40 tw-backdrop-blur-sm tw-z-[9998] tw-hidden tw-items-center tw-justify-center tw-p-3 md:tw-p-4 tw-transition-all';
    wrapper.innerHTML = `
      <div class="tw-bg-[#F9FAFB] tw-w-full tw-max-w-md md:tw-max-w-2xl lg:tw-max-w-3xl xl:tw-max-w-4xl tw-rounded-[24px] md:tw-rounded-[32px] tw-shadow-2xl tw-overflow-hidden tw-border tw-border-white/20 tw-transition-all tw-max-h-[95vh] tw-overflow-y-auto scrollbar-hide">
        <!-- Header -->
        <div class="tw-flex tw-items-center tw-justify-between tw-px-5 tw-py-4 md:tw-px-8 md:tw-py-6">
          <h3 id="billing-modal-title" class="tw-text-xl md:tw-text-2xl tw-font-bold tw-text-gray-900">Adicionar Creditos</h3>
          <button id="billing-modal-close" class="tw-text-gray-400 hover:tw-text-gray-600 tw-transition-colors">
            <svg class="tw-w-6 tw-h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="tw-px-5 md:tw-px-8 tw-pb-6 md:tw-pb-10">
          <!-- Billing Toggle (Visual Only) -->
          <div class="tw-flex tw-justify-center tw-mb-6 md:tw-mb-10">
            <div class="tw-bg-gray-100 tw-p-1 tw-rounded-full tw-flex tw-gap-1">
              <button class="tw-bg-white tw-px-6 tw-py-2 tw-rounded-full tw-text-sm tw-font-semibold tw-shadow-sm">Playground</button>
                <button data-testid="@ai-playground-v2/sidebar/logo" type="button" class="flex items-center gap-2">
                  <h1 class="sr-only">VEED AI Playground - Criador de Conteúdo com IA</h1>
                  <img src="https://res.cloudinary.com/dxwul5fff/image/upload/v1758373981/agente_gpt_icon_butpu3.svg" alt="Logo VEED" class="h-10 w-10 rounded-lg object-cover" />
                </button>
            </div>
          </div>

          <div id="billing-status" class="tw-hidden tw-mb-6 tw-text-sm tw-rounded-xl tw-p-4 tw-border"></div>

          <!-- Plans Grid -->
          <div id="billing-packages" class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 md:tw-gap-6 tw-items-start">
            <!-- Functional Plan: Starter -->
            <div id="plan-starter-container" class="tw-bg-white tw-rounded-2xl md:tw-rounded-3xl tw-border-2 tw-border-green-500 tw-p-5 md:tw-p-8 tw-relative tw-shadow-lg tw-transition-all">
              <div id="billing-starter-badge" class="tw-absolute -tw-top-4 tw-left-1/2 -tw-translate-x-1/2 tw-bg-[#5666f5] tw-text-white tw-px-4 tw-py-1 tw-rounded-full tw-text-xs tw-font-bold tw-flex tw-items-center tw-gap-1">
                <svg class="tw-w-3 tw-h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                Uso Profissional
              </div>
              <div class="tw-mb-6">
                <h4 class="tw-text-2xl tw-font-bold tw-text-gray-900">Starter</h4>
                <p id="billing-starter-subtitle" class="tw-text-gray-500 tw-text-sm tw-mt-1">Ferramentas avancadas para produtividade.</p>
              </div>
              <div class="tw-mb-8">
                <span class="tw-text-5xl tw-font-extrabold tw-text-gray-900">R$ 50</span>
                <span class="tw-text-gray-400 tw-text-sm">/ 500 Créditos</span>
              </div>
              
              <button id="btn-starter-checkout" class="tw-w-full tw-bg-[#5666f5] hover:tw-bg-[#5666f5] tw-text-white tw-font-bold tw-py-4 tw-rounded-2xl tw-mb-8 tw-transition-all tw-shadow-md active:tw-scale-95 tw-flex tw-flex-row tw-items-center tw-justify-center">
                Pagar
              </button>

              <div class="tw-space-y-4">
                <p class="tw-text-xs tw-font-bold tw-text-gray-400 tw-uppercase tw-tracking-wider">Use com quiser:</p>
                <ul class="tw-space-y-3">
                  <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-700">
                    <svg class="tw-w-5 tw-h-5 tw-text-[#5666f5] tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>500 Créditos</span>
                  </li>
                  <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-700">
                    <svg class="tw-w-5 tw-h-5 tw-text-[#5666f5] tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span><strong>Imagens:</strong> Texto para Imagem, Editor, Upscale</span>
                  </li>
                   <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-700">
                    <svg class="tw-w-5 tw-h-5 tw-text-[#5666f5] tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span><strong>Vídeo:</strong> Texto para Vídeo, Imagem p/ Vídeo, Edições</span>
                  </li>
                   <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-700">
                    <svg class="tw-w-5 tw-h-5 tw-text-[#5666f5] tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span><strong>Avatars:</strong> Talking Avatar, FaceSwap</span>
                  </li>
                  <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-700">
                    <svg class="tw-w-5 tw-h-5 tw-text-[#5666f5] tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>Suporte Prioritário</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Visual Plan: Premium (Placeholder) -->
            <div class="tw-hidden md:tw-block tw-bg-white/50 tw-rounded-2xl md:tw-rounded-3xl tw-border tw-border-gray-200 tw-p-5 md:tw-p-8 tw-opacity-80 tw-transition-all">
              <div class="tw-mb-6">
                <h4 class="tw-text-2xl tw-font-bold tw-text-gray-900">Premium</h4>
                <p class="tw-text-gray-500 tw-text-sm tw-mt-1">Acesso completo para máxima criatividade.</p>
              </div>
              <div class="tw-mb-8">
                <span class="tw-text-5xl tw-font-extrabold tw-text-gray-900">--</span>
                <span class="tw-text-gray-400 tw-text-sm">/ em breve</span>
              </div>
              
              <button disabled class="tw-w-full tw-bg-white tw-border tw-border-gray-200 tw-text-gray-400 tw-font-bold tw-py-4 tw-rounded-2xl tw-mb-8">
                Indisponível
              </button>

              <div class="tw-space-y-4">
                 <p class="tw-text-xs tw-font-bold tw-text-gray-400 tw-uppercase tw-tracking-wider">Incluso no plano:</p>
                 <ul class="tw-space-y-3">
                  <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-400">
                    <svg class="tw-w-5 tw-h-5 tw-text-gray-300 tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>Uso Ilimitado</span>
                  </li>
                  <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-400">
                    <svg class="tw-w-5 tw-h-5 tw-text-gray-300 tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>Todos os motores e modelos</span>
                  </li>
                  <li class="tw-flex tw-items-start tw-gap-3 tw-text-sm tw-text-gray-400">
                    <svg class="tw-w-5 tw-h-5 tw-text-gray-300 tw-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    <span>Acesso Antecipado a Beta</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Bottom Summary -->
          <div class="tw-mt-6 md:tw-mt-10 tw-pt-6 md:tw-pt-8 tw-border-t tw-border-gray-100 tw-text-center">
            <p class="tw-text-[10px] md:tw-text-xs tw-font-bold tw-text-gray-400 tw-uppercase tw-tracking-widest tw-mb-4 md:tw-mb-6">TODOS OS PLANOS INCLUEM:</p>
            <div class="tw-flex tw-flex-wrap tw-justify-center tw-gap-2">
              <span class="tw-bg-gray-100 tw-px-3 md:tw-px-4 tw-py-1.5 md:tw-py-2 tw-rounded-full tw-text-[10px] md:tw-text-xs tw-font-semibold tw-text-gray-600">Geração Ultra Rápida</span>
              <span class="tw-bg-gray-100 tw-px-3 md:tw-px-4 tw-py-1.5 md:tw-py-2 tw-rounded-full tw-text-[10px] md:tw-text-xs tw-font-semibold tw-text-gray-600">Download em Alta Definição</span>
              <span class="tw-bg-gray-100 tw-px-3 md:tw-px-4 tw-py-1.5 md:tw-py-2 tw-rounded-full tw-text-[10px] md:tw-text-xs tw-font-semibold tw-text-gray-600">Reembolso 7 dias</span>
            </div>
          </div>
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
    btn.addEventListener('click', () => {
      telemetry.track('topup_cta_clicked', {
        route_or_feature: 'credits-dropdown',
        props: this.withAbVariant({ trigger: 'header_credits' })
      });
      this.openModal({ trigger: 'header_credits' });
    });
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
      telemetry.track('topup_cta_clicked', {
        route_or_feature: 'billing-modal',
        props: this.withAbVariant({ trigger: 'first_signup_auto' })
      });
      this.openModal({ message: 'Conta criada com sucesso. Escolha um plano para adicionar creditos.', trigger: 'first_signup_auto' });
    });
  },

  async openModal(options = {}) {
    const modal = document.getElementById('billing-modal');
    if (!modal) return;

    this.state.open = true;
    modal.classList.remove('tw-hidden');
    modal.classList.add('tw-flex');
    this.applyVariantUi();

    if (options.message) {
      this.showStatus(options.message, 'info');
    } else {
      this.hideStatus();
    }

    telemetry.track('topup_modal_opened', {
      route_or_feature: 'billing-modal',
      props: this.withAbVariant({ trigger: options.trigger || 'unknown' })
    });

    await this.loadPackages();
  },

  closeModal() {
    const modal = document.getElementById('billing-modal');
    if (!modal) return;
    this.state.open = false;
    telemetry.track('topup_modal_closed', {
      route_or_feature: 'billing-modal',
      props: this.withAbVariant()
    });
    modal.classList.remove('tw-flex');
    modal.classList.add('tw-hidden');
  },

  showStatus(message, type = 'info') {
    const status = document.getElementById('billing-status');
    if (!status) return;

    status.classList.remove('tw-hidden', 'tw-bg-red-50', 'tw-text-red-700', 'tw-bg-green-50', 'tw-text-green-700', 'tw-bg-blue-50', 'tw-text-blue-700', 'tw-border-red-100', 'tw-border-green-100', 'tw-border-blue-100');
    status.classList.add('tw-block');
    if (type === 'error') status.classList.add('tw-bg-red-50', 'tw-text-red-700', 'tw-border-red-100');
    else if (type === 'success') status.classList.add('tw-bg-green-50', 'tw-text-green-700', 'tw-border-green-100');
    else status.classList.add('tw-bg-blue-50', 'tw-text-blue-700', 'tw-border-blue-100');

    status.textContent = message;
  },

  hideStatus() {
    const status = document.getElementById('billing-status');
    if (!status) return;
    status.classList.add('tw-hidden');
    status.classList.remove(
      'tw-block',
      'tw-bg-red-50',
      'tw-text-red-700',
      'tw-bg-green-50',
      'tw-text-green-700',
      'tw-bg-blue-50',
      'tw-text-blue-700',
      'tw-border-red-100',
      'tw-border-green-100',
      'tw-border-blue-100'
    );
    status.textContent = '';
  },

  async loadPackages() {
    const container = document.getElementById('plan-starter-container');
    const btn = document.getElementById('btn-starter-checkout');
    if (!container || !btn) return;

    try {
      const data = await api.get('/billing/packages');
      const packages = data.packages || [];
      // Find the Starter package (assuming it has "Starter" in the name or we use the first one if empty)
      const starterPkg = packages.find(p => p.name && p.name.toLowerCase().includes('starter')) || packages[0];
      
      if (starterPkg) {
        btn.setAttribute('data-package-id', starterPkg.id);
        btn.onclick = () => this.startCheckout(starterPkg.id);
        this.applyVariantUi();
      } else {
        btn.textContent = 'Erro ao carregar ID';
        btn.disabled = true;
      }
    } catch (err) {
      console.error('Packages load error:', err);
      this.showStatus('Erro ao carregar pacotes da API.', 'error');
    }
  },

  async startCheckout(packageId) {
    if (!packageId || this.state.loading) return;
    this.state.loading = true;
    this.showStatus('Criando seu pagamento, aguarde...', 'info');

    try {
      telemetry.track('topup_checkout_started', {
        route_or_feature: 'billing-checkout',
        props: this.withAbVariant({ package_id: packageId })
      });
      const data = await api.post('/billing/checkout-session', { package_id: packageId });
      if (!data.checkout_url) throw new Error('Checkout URL nao retornada.');
      window.location.href = data.checkout_url;
    } catch (err) {
      telemetry.trackError('billing.startCheckout', err.message);
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
      telemetry.track('topup_checkout_returned_cancel', {
        route_or_feature: 'billing-checkout',
        props: this.withAbVariant({ order_id: orderId })
      });
      this.openModal({ message: 'Pagamento cancelado. Escolha um plano para tentar novamente.' });
      this.cleanupCheckoutParams();
      return;
    }

    if (checkoutState === 'success') {
      telemetry.track('topup_checkout_returned_success', {
        route_or_feature: 'billing-checkout',
        props: this.withAbVariant({ order_id: orderId })
      });
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
          telemetry.track('topup_order_paid', {
            route_or_feature: 'billing-order',
            props: this.withAbVariant({ order_id: orderId })
          });
          this.showStatus('Opá! Pagamento confirmado. Creditos atualizados!', 'success');
          await auth.refreshUser();
          return;
        }

        if (status === 'failed' || status === 'expired') {
          telemetry.track('topup_order_not_paid', {
            route_or_feature: 'billing-order',
            props: this.withAbVariant({ order_id: orderId, status })
          });
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
