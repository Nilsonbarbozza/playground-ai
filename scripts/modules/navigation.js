import { projects } from './projects.js';

/**
 * Navigation Module
 * Handles SPA view switching and sidebar interactions.
 */
export const navigation = {
  views: [
    'view-text-to-image',
    'view-image-editor',
    'view-video',
    'view-faceswap',
    'view-projects'
  ],

  init() {
    this.initSidebar();
    this.initViewSwitching();
    console.log('[Nav] Initialized');
  },

  switchView(viewId) {
    this.views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('tw-hidden', id !== viewId);
    });
    
    // Auto-close sidebar on mobile after navigating
    if (window.innerWidth < 768) {
      this.closeSidebar();
    }

    // Scroll top
    window.scrollTo(0, 0);

    // Specific view actions
    if (viewId === 'view-projects') {
      projects.loadGallery();
    }
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
    const openBtn = document.getElementById('btn-open-sidebar');
    const closeBtn = document.getElementById('btn-close-sidebar');

    if (openBtn) openBtn.onclick = () => this.openSidebar();
    if (closeBtn) closeBtn.onclick = () => this.closeSidebar();

    // Click outside to close (Mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth < 1024 && 
          sidebar && !sidebar.classList.contains('-tw-translate-x-full') && 
          !sidebar.contains(e.target) && 
          e.target !== openBtn) {
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
