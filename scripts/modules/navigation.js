import { projects } from './projects.js';
import { telemetry } from '../services/telemetry.js';

/**
 * Navigation Module
 * Handles SPA view switching and sidebar interactions.
 */
export const navigation = {
  views: [
    'view-text-to-image',
    'view-image-editor',
    'view-upscale',
    'view-video',
    'view-video-editor',
    'view-faceswap',
    'view-avatar',
    'view-projects'
  ],
  _lastViewId: null,
  _lastViewOpenedAt: null,

  init() {
    this.initSidebar();
    this.initViewSwitching();
    console.log('[Nav] Initialized');
  },

  switchView(viewId) {
    const now = Date.now();
    const previousDuration = this._lastViewOpenedAt ? now - this._lastViewOpenedAt : null;
    const previousViewId = this._lastViewId;

    this.views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('tw-hidden', id !== viewId);
      
      // Update sidebar active state
      const baseId = id.replace('view-', '');
      const btn = document.querySelector(`[data-view="${baseId}"]`);
      if (btn) {
        if (id === viewId) {
          btn.classList.add('tw-bg-gray-100', 'tw-text-black', 'tw-font-bold');
          btn.classList.remove('tw-bg-transparent', 'tw-text-gray-500');
          btn.setAttribute('data-active', 'true');
        } else {
          btn.classList.remove('tw-bg-gray-100', 'tw-text-black', 'tw-font-bold');
          btn.classList.add('tw-bg-transparent', 'tw-text-gray-500');
          btn.setAttribute('data-active', 'false');
        }
      }
    });

    // Specific view actions
    if (viewId === 'view-projects') {
      projects.loadGallery();
    }

    if (previousViewId && Number.isFinite(previousDuration) && previousDuration >= 0) {
      telemetry.track('view_time_spent', {
        view_id: previousViewId,
        route_or_feature: previousViewId,
        props: { duration_ms: previousDuration }
      });
    }

    telemetry.trackView(viewId, previousDuration);
    this._lastViewId = viewId;
    this._lastViewOpenedAt = now;
  },

  initViewSwitching() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        this.switchView(`view-${view}`);
      });
    });
  },

  initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('mobile-hamburger');
    const closeBtn = document.getElementById('mobile-sidebar-close');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');

    if (openBtn) openBtn.onclick = () => this.openSidebar();
    if (closeBtn) closeBtn.onclick = () => this.closeSidebar();
    if (toggleBtn) toggleBtn.onclick = () => this.closeSidebar();

    // Click outside to close (Mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth < 1024 && 
          sidebar && !sidebar.classList.contains('-tw-translate-x-full') && 
          !sidebar.contains(e.target) && 
          openBtn && !openBtn.contains(e.target)) {
        this.closeSidebar();
      }
    });
  },

  openSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('-tw-translate-x-full');
    document.body.style.overflow = 'hidden';
  },

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('-tw-translate-x-full');
    document.body.style.overflow = '';
  }
};
