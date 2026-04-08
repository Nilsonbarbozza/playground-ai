/**
 * UI Utility Module
 * Handles loading states, toasts, and DOM helpers.
 */
export const ui = {
  setLoading(buttonId, isLoading, text = 'Processando...') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg class="tw-animate-spin tw-h-5 tw-w-5 tw-mr-2" viewBox="0 0 24 24">
          <circle class="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> ${text}
      `;
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || 'Confirmar';
      btn.disabled = false;
    }
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.log(`[Toast ${type.toUpperCase()}] ${message}`);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `magic-toast magic-toast-${type}`;

    const icons = {
      success: '✨',
      error: '⚡',
      warning: '⚠️',
      info: '🔵'
    };
    const icon = icons[type] || icons.info;

    toast.innerHTML = `
      <span class="magic-toast-icon">${icon}</span>
      <div class="tw-flex-1">${message}</div>
    `;

    container.appendChild(toast);

    const removeToast = () => {
      toast.classList.add('out');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback para remover se transitionend falhar
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    };

    setTimeout(removeToast, 4000);

    toast.addEventListener('click', removeToast);
  },

  updateCreditsDisplay(credits) {
    const el = document.getElementById('user-credits');
    if (el) el.textContent = credits;
  }
};
