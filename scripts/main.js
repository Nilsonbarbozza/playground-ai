/**
 * VEED AI Playground - Main Script
 * Following UX Patterns and premium standards.
 */

document.addEventListener('DOMContentLoaded', () => {
    initImageHandlers();
    initSidebarToggle();
    initImageEditor();
});

/**
 * Handles image loading errors globally, replacing inline 'onerror' attributes.
 */
function initImageHandlers() {
    document.querySelectorAll('img').forEach(img => {
        // Remove inline onerror if present during cleanup
        img.removeAttribute('onerror');
        
        img.addEventListener('error', function() {
            const dataSrc = this.getAttribute('data-src');
            if (dataSrc && this.src !== dataSrc) {
                console.warn(`[ImageHandler] Recovery attempt for: ${this.src}`);
                this.src = dataSrc;
            } else {
                this.style.display = 'none'; // Fallback if no data-src or also fails
            }
        });
    });
}

/**
 * Sidebar toggle behavior following layout-system.md
 */
function initSidebarToggle() {
    const sidebar = document.querySelector('[data-testid="@ai-playground-v2/sidebar"]');
  const toggleBtn = document.querySelector('[data-testid="@ai-playground-v2/sidebar/toggle-button"]');
  const hamburgerBtn = document.getElementById('mobile-hamburger');
  const closeBtn = document.getElementById('mobile-sidebar-close');

  function openSidebar() {
    sidebar.classList.remove('hidden');
    sidebar.classList.add('flex');
    if (window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    }
  }

  function closeSidebar() {
    if (window.innerWidth < 768) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
      document.body.style.overflow = '';
    } else {
      sidebar.classList.toggle('hidden');
    }
  }

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', closeSidebar);
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', openSidebar);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
  }

  // Handle responsiveness
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove('hidden');
      sidebar.classList.add('flex');
      document.body.style.overflow = '';
    } else {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
    }
  });

  // Initial state check
  if (window.innerWidth < 768) {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('flex');
  }
}

/**
 * AI Image Editor - Frontend Logic
 * Refactored for stability and VEED-style premium UX.
 */
function initImageEditor() {
  const elements = {
    uploader: document.getElementById('uploader-container'),
    placeholder: document.getElementById('uploader-placeholder'),
    previewContainer: document.getElementById('preview-container'),
    previewImg: document.getElementById('preview-img'),
    removeBtn: document.getElementById('remove-img'),
    fileInput: document.getElementById('file-input'),
    controls: document.getElementById('editor-controls'),
    promptInput: document.getElementById('image-prompt'),
    generateBtn: document.getElementById('generate-button'),
    btnText: document.getElementById('btn-text'),
    spinner: document.getElementById('loading-spinner'),
    errorDisplay: document.getElementById('error-message')
  };

  // State Management
  let currentState = 'IDLE'; // IDLE, PREVIEW, PROCESSING

  const setState = (state, data = {}) => {
    currentState = state;
    console.log(`[Editor State] -> ${state}`);

    // Hide everything by default
    elements.placeholder.classList.add('tw-hidden');
    elements.previewContainer.classList.add('tw-hidden');
    elements.controls.classList.add('tw-hidden');
    elements.spinner.classList.add('tw-hidden');
    elements.errorDisplay.classList.add('tw-hidden');
    elements.generateBtn.disabled = false;
    elements.btnText.innerText = 'Editar com IA';

    switch (state) {
      case 'IDLE':
        elements.placeholder.classList.remove('tw-hidden');
        elements.fileInput.value = '';
        break;

      case 'PREVIEW':
        elements.previewContainer.classList.remove('tw-hidden');
        elements.controls.classList.remove('tw-hidden');
        if (data.src) elements.previewImg.src = data.src;
        break;

      case 'PROCESSING':
        elements.previewContainer.classList.remove('tw-hidden');
        elements.controls.classList.remove('tw-hidden');
        elements.spinner.classList.remove('tw-hidden');
        elements.generateBtn.disabled = true;
        elements.btnText.innerText = 'Processando...';
        break;

      case 'ERROR':
        elements.previewContainer.classList.remove('tw-hidden');
        elements.controls.classList.remove('tw-hidden');
        elements.errorDisplay.classList.remove('tw-hidden');
        elements.errorDisplay.innerText = data.message || 'Erro inesperado.';
        break;
    }
  };

  // Events
  elements.uploader.addEventListener('click', (e) => {
    if (currentState === 'IDLE') elements.fileInput.click();
  });

  elements.removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setState('IDLE');
  });

  elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validation from agent.md: Max 4MB, PNG or JPG
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      const maxSize = 4 * 1024 * 1024; // 4MB

      if (!validTypes.includes(file.type)) {
        setState('ERROR', { message: 'Formato inválido. Use um arquivo PNG ou JPG.' });
        return;
      }
      
      if (file.size > maxSize) {
        setState('ERROR', { message: 'Imagem muito pesada. O limite máximo é de 4MB.' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => setState('PREVIEW', { src: ev.target.result });
      reader.readAsDataURL(file);
    }
  });


  elements.generateBtn.addEventListener('click', async () => {
    const prompt = elements.promptInput.value.trim();
    const file = elements.fileInput.files[0];

    if (!prompt) {
      elements.promptInput.focus();
      elements.promptInput.classList.add('tw-ring-red-400');
      setTimeout(() => elements.promptInput.classList.remove('tw-ring-red-400'), 2000);
      return;
    }

    setState('PROCESSING');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('prompt', prompt);

      const response = await fetch('/api/edit', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no servidor.');
      }

      if (data.url) {
        setState('PREVIEW', { src: data.url });
        // Success micro-interaction
        elements.previewImg.classList.add('tw-ring-4', 'tw-ring-green-400');
        setTimeout(() => elements.previewImg.classList.remove('tw-ring-4', 'tw-ring-green-400'), 3000);
      }
    } catch (err) {
      console.error('[Editor API Error]', err);
      setState('ERROR', { message: err.message });
    }
  });
}
