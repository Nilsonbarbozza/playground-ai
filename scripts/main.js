/**
 * VEED AI Playground - Main Script
 * Following UX Patterns and premium standards.
 */

document.addEventListener('DOMContentLoaded', () => {
    initImageHandlers();
    initSidebarToggle();
    initImageEditor();
    initAuthData();
    initNavigation();
    initVideoGenerator();
    initFaceSwapGenerator();
    initText2ImgGenerator();
});

/**
 * SAAS: Text-to-Image Generator Controller
 */
function initText2ImgGenerator() {
  const promptInput = document.getElementById('t2i-prompt');
  const generateBtn = document.getElementById('btn-generate-t2i');
  const errorMessage = document.getElementById('t2i-error');
  const placeholder = document.getElementById('t2i-placeholder');
  const previewImg = document.getElementById('t2i-preview-img');
  const loader = document.getElementById('t2i-loader');

  if (!promptInput || !generateBtn) return;

  generateBtn.addEventListener('click', async () => {
    const promptValue = promptInput.value.trim();
    if (!promptValue) {
      errorMessage.textContent = 'Por favor, descreva a imagem desejada.';
      errorMessage.classList.remove('tw-hidden');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    errorMessage.classList.add('tw-hidden');
    generateBtn.disabled = true;
    placeholder.classList.add('tw-hidden');
    previewImg.classList.add('tw-hidden');
    loader.classList.remove('tw-hidden');
    loader.classList.add('tw-flex');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: promptValue })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao gerar imagem.');
      }

      previewImg.src = data.url;
      loader.classList.add('tw-hidden');
      previewImg.classList.remove('tw-hidden');
      initAuthData(); // Atualiza saldo

    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.remove('tw-hidden');
      loader.classList.add('tw-hidden');
      placeholder.classList.remove('tw-hidden');
    } finally {
      generateBtn.disabled = false;
    }
  });

  // Botão de Download para Texto-para-Imagem
  const downloadBtn = document.getElementById('btn-download-t2i');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const src = previewImg.src;
      if (src && !src.includes('placeholder')) {
        const link = document.createElement('a');
        link.href = src;
        link.download = `ai-image-${Date.now()}.png`;
        link.click();
      }
    });
  }
}

/**
 * SAAS: SPA Navigation Controller
 */
function initNavigation() {
  const views = {
    textToImage: document.getElementById('view-text2img'),
    projects: document.getElementById('view-projects'),
    imageEditor: document.getElementById('view-image-editor'),
    video: document.getElementById('view-video'),
    faceswap: document.getElementById('view-faceswap')
  };

  const buttons = {
    projects: document.querySelector('[data-testid="@ai-playground-v2/sidebar-my-creations"]'),
    textToImage: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/text-to-image"]'),
    imageToImage: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/image-to-image"]'),
    textToVideo: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/text-to-video"]'),
    imageToVideo: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/image-to-video"]'),
    faceswap: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/video-to-video"]')
  };

  const inactiveClasses = ['bg-tertiary', 'text-tertiary-foreground', 'hover:bg-tertiary-hover', 'active:bg-tertiary-hover'];
  const activeClasses = ['bg-gray-100', 'text-secondary-foreground', 'hover:bg-gray-200', 'active:bg-gray-200'];

  function switchView(viewName, activeButtonKey) {
    Object.values(views).forEach(view => {
      if (view) {
        view.classList.add('hidden', 'tw-hidden');
        view.classList.remove('active', 'block', 'tw-flex');
        view.style.display = 'none';
      }
    });
    
    Object.values(buttons).forEach(btn => {
      if (btn) {
        btn.setAttribute('data-active', 'false');
        btn.classList.add(...inactiveClasses);
        btn.classList.remove(...activeClasses);
      }
    });

    const targetView = views[viewName];
    if (targetView) {
      targetView.classList.remove('hidden', 'tw-hidden');
      if (viewName === 'imageEditor' || viewName === 'projects') {
        targetView.style.display = 'block';
      } else {
        targetView.classList.add('tw-flex');
        targetView.style.display = '';
      }
    }

    const targetBtn = buttons[activeButtonKey];
    if (targetBtn) {
       targetBtn.setAttribute('data-active', 'true');
       targetBtn.classList.remove(...inactiveClasses);
       targetBtn.classList.add(...activeClasses);
    }

    if (viewName === 'projects') loadProjectsView();
  }

  if (buttons.projects) buttons.projects.addEventListener('click', () => switchView('projects', 'projects'));
  if (buttons.textToImage) buttons.textToImage.addEventListener('click', () => switchView('textToImage', 'textToImage'));
  if (buttons.imageToImage) buttons.imageToImage.addEventListener('click', () => switchView('imageEditor', 'imageToImage'));
  if (buttons.textToVideo) buttons.textToVideo.addEventListener('click', () => switchView('video', 'textToVideo'));
  if (buttons.imageToVideo) buttons.imageToVideo.addEventListener('click', () => switchView('video', 'imageToVideo'));
  if (buttons.faceswap) buttons.faceswap.addEventListener('click', () => switchView('faceswap', 'faceswap'));

  // Default
  switchView('imageEditor', 'imageToImage');
}

async function loadProjectsView() {
  const grid = document.getElementById('projects-grid');
  const emptyState = document.getElementById('projects-empty');
  if (!grid || !emptyState) return;

  grid.innerHTML = '<div class="tw-col-span-full tw-text-center tw-text-gray-500">Carregando projetos...</div>';
  emptyState.classList.add('tw-hidden');

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('/api/user/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.projects && data.projects.length > 0) {
      grid.innerHTML = data.projects.map(p => `
        <div class="tw-bg-white tw-border tw-border-gray-100 tw-rounded-xl tw-overflow-hidden tw-shadow-sm hover:tw-shadow-md tw-transition-all">
          <img src="${p.image_url}" alt="Projeto" class="tw-w-full tw-h-48 tw-object-cover" />
          <div class="tw-p-4">
            <p class="tw-text-xs tw-text-gray-400 tw-mb-1">${new Date(p.created_at).toLocaleDateString()}</p>
            <p class="tw-text-sm tw-font-medium tw-text-gray-700 tw-truncate" title="${p.prompt}">${p.prompt || 'Edição Sem Prompt'}</p>
          </div>
        </div>
      `).join('');
    } else {
      grid.innerHTML = '';
      emptyState.classList.remove('tw-hidden');
      emptyState.classList.add('tw-flex');
    }
  } catch (err) {
    grid.innerHTML = '<div class="tw-col-span-full tw-text-center tw-text-red-500">Erro ao carregar a galeria.</div>';
  }
}

/**
 * SAAS: Video Generator Controller
 */
function initVideoGenerator() {
  const promptInput = document.getElementById('video-prompt');
  const generateBtn = document.getElementById('btn-generate-video');
  const fileInput = document.getElementById('video-file-input');
  const uploaderDiv = document.getElementById('video-image-uploader');
  const previewImg = document.getElementById('video-preview-img');
  const placeholder = document.getElementById('video-placeholder');
  const videoPlayer = document.getElementById('video-player');
  const loader = document.getElementById('video-loader');
  const errorDiv = document.getElementById('video-error');

  if (!generateBtn) return;

  if (uploaderDiv) {
    uploaderDiv.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        previewImg.src = URL.createObjectURL(file);
        previewImg.classList.remove('tw-hidden');
      }
    });
  }

  generateBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const prompt = promptInput.value.trim();
    const file = fileInput.files[0];

    if (!prompt && !file) {
      errorDiv.textContent = 'Insira um prompt ou uma imagem.';
      errorDiv.classList.remove('tw-hidden');
      return;
    }

    errorDiv.classList.add('tw-hidden');
    generateBtn.disabled = true;
    placeholder.classList.add('tw-hidden');
    videoPlayer.classList.add('tw-hidden');
    loader.classList.remove('tw-hidden');
    loader.classList.add('tw-flex');

    const formData = new FormData();
    if (file) formData.append('image', file);
    if (prompt) formData.append('prompt', prompt);

    try {
      const resSubmit = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const dataSubmit = await resSubmit.json();
      if (!resSubmit.ok) throw new Error(dataSubmit.error || 'Erro ao iniciar geração.');

      const genId = dataSubmit.generation_id;

      const poll = setInterval(async () => {
        try {
          const resPoll = await fetch(`/api/video/status/${genId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resPoll.status === 202) return;

          const dataPoll = await resPoll.json();
          clearInterval(poll);

          if (resPoll.ok && dataPoll.status === 'finished') {
            videoPlayer.src = dataPoll.url;
            loader.classList.add('tw-hidden');
            videoPlayer.classList.remove('tw-hidden');
            initAuthData();
          } else {
            throw new Error(dataPoll.error || 'Erro no processamento do vídeo.');
          }
        } catch (pollErr) {
          clearInterval(poll);
          errorDiv.textContent = pollErr.message;
          errorDiv.classList.remove('tw-hidden');
          loader.classList.add('tw-hidden');
          placeholder.classList.remove('tw-hidden');
        } finally {
          generateBtn.disabled = false;
        }
      }, 10000);

    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove('tw-hidden');
      loader.classList.add('tw-hidden');
      placeholder.classList.remove('tw-hidden');
      generateBtn.disabled = false;
    }
  });

  const downloadBtn = document.getElementById('btn-download-video');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const src = videoPlayer.src;
      if (src) {
        const link = document.createElement('a');
        link.href = src;
        link.download = `ai-video-${Date.now()}.mp4`;
        link.click();
      }
    });
  }
}

/**
 * SAAS: Face Swap Controller
 */
function initFaceSwapGenerator() {
  const targetInput = document.getElementById('faceswap-target-input');
  const sourceInput = document.getElementById('faceswap-source-input');
  const targetUploader = document.getElementById('faceswap-target-uploader');
  const sourceUploader = document.getElementById('faceswap-source-uploader');
  const targetPreview = document.getElementById('faceswap-target-preview');
  const sourcePreview = document.getElementById('faceswap-source-preview');
  
  const generateBtn = document.getElementById('btn-generate-faceswap');
  const placeholder = document.getElementById('faceswap-placeholder');
  const resultImg = document.getElementById('faceswap-result');
  const loader = document.getElementById('faceswap-loader');
  const errorDiv = document.getElementById('faceswap-error');

  if (!generateBtn) return;

  targetUploader.addEventListener('click', () => targetInput.click());
  sourceUploader.addEventListener('click', () => sourceInput.click());

  targetInput.addEventListener('change', () => {
    if (targetInput.files[0]) {
      targetPreview.src = URL.createObjectURL(targetInput.files[0]);
      targetPreview.classList.remove('tw-hidden');
    }
  });

  sourceInput.addEventListener('change', () => {
    if (sourceInput.files[0]) {
      sourcePreview.src = URL.createObjectURL(sourceInput.files[0]);
      sourcePreview.classList.remove('tw-hidden');
    }
  });

  generateBtn.addEventListener('click', async () => {
    const fTarget = targetInput.files[0];
    const fSource = sourceInput.files[0];

    if (!fTarget || !fSource) {
      errorDiv.textContent = 'Selecione ambas as imagens.';
      errorDiv.classList.remove('tw-hidden');
      return;
    }

    const token = localStorage.getItem('token');
    errorDiv.classList.add('tw-hidden');
    generateBtn.disabled = true;
    placeholder.classList.add('tw-hidden');
    resultImg.classList.add('tw-hidden');
    loader.classList.remove('tw-hidden');
    loader.classList.add('tw-flex');

    const formData = new FormData();
    formData.append('target_image', fTarget);
    formData.append('swap_image', fSource);

    try {
      const response = await fetch('/api/faceswap/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro no faceswap.');

      resultImg.src = data.url;
      loader.classList.add('tw-hidden');
      resultImg.classList.remove('tw-hidden');
      initAuthData();

    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove('tw-hidden');
      loader.classList.add('tw-hidden');
      placeholder.classList.remove('tw-hidden');
    } finally {
      generateBtn.disabled = false;
    }
  });

  const downloadBtn = document.getElementById('btn-download-faceswap');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const src = resultImg.src;
      if (src && !src.includes('placeholder')) {
        const link = document.createElement('a');
        link.href = src;
        link.download = `faceswap-${Date.now()}.png`;
        link.click();
      }
    });
  }
}

async function initAuthData() {
  const token = localStorage.getItem('token');
  const creditsEl = document.getElementById('auth-credits');
  if (!token) return;

  try {
    const res = await fetch('/api/user/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && creditsEl) creditsEl.innerText = data.user.credits;
  } catch (err) {
    console.warn('Auth check failed');
  }
}

function initImageHandlers() {
    document.querySelectorAll('img').forEach(img => {
        img.removeAttribute('onerror');
        img.addEventListener('error', function() {
            const dataSrc = this.getAttribute('data-src');
            if (dataSrc && this.src !== dataSrc) this.src = dataSrc;
            else this.style.display = 'none';
        });
    });
}

function initSidebarToggle() {
  const sidebar = document.querySelector('[data-testid="@ai-playground-v2/sidebar"]');
  const toggleBtn = document.querySelector('[data-testid="@ai-playground-v2/sidebar/toggle-button"]');
  const hamburgerBtn = document.getElementById('mobile-hamburger');
  const closeBtn = document.getElementById('mobile-sidebar-close');

  if (!sidebar) return;

  function openSidebar() {
    sidebar.classList.remove('hidden', 'tw-hidden');
    sidebar.classList.add('tw-flex');
    sidebar.classList.remove('md:hidden'); // Garantir visibilidade mobile
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (window.innerWidth < 768) {
      sidebar.classList.add('tw-hidden');
      sidebar.classList.remove('tw-flex');
      document.body.style.overflow = '';
    } else {
      sidebar.classList.toggle('tw-hidden');
    }
  }

  if (toggleBtn) toggleBtn.addEventListener('click', closeSidebar);
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSidebar();
  });
  if (closeBtn) closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSidebar();
  });

  // Fechar ao clicar fora (no conteúdo principal) quando mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768 && !sidebar.classList.contains('tw-hidden')) {
      if (!sidebar.contains(e.target) && e.target !== hamburgerBtn) {
        closeSidebar();
      }
    }
  });

  // Ajuste ao redimensionar
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove('hidden', 'tw-hidden');
      sidebar.classList.add('tw-flex');
      document.body.style.overflow = '';
    } else {
      if (!sidebar.classList.contains('tw-flex')) {
        sidebar.classList.add('tw-hidden');
      }
    }
  });
}

/**
 * AI Image Editor
 */
function initImageEditor() {
  const elements = {
    uploader: document.getElementById('uploader-container'),
    placeholder: document.getElementById('uploader-placeholder'),
    previewContainer: document.getElementById('preview-container'),
    previewImg: document.getElementById('preview-img'),
    maskCanvas: document.getElementById('mask-canvas'),
    removeBtn: document.getElementById('remove-img'),
    fileInput: document.getElementById('file-input'),
    controls: document.getElementById('editor-controls'),
    promptInput: document.getElementById('image-prompt'),
    generateBtn: document.getElementById('generate-button'),
    btnIcon: document.getElementById('btn-icon'),
    btnText: document.getElementById('btn-text'),
    spinner: document.getElementById('loading-spinner'),
    errorDisplay: document.getElementById('error-message'),
    brushSize: document.getElementById('brush-size'),
    clearMask: document.getElementById('clear-mask')
  };

  const canvasObj = {
    ctx: elements.maskCanvas ? elements.maskCanvas.getContext('2d') : null,
    isDrawing: false,
    lastX: 0,
    lastY: 0
  };

  let currentState = 'IDLE';
  let originalImageForExtraction = new Image();
  originalImageForExtraction.crossOrigin = "anonymous";

  const clearCanvas = () => {
    if (canvasObj.ctx) canvasObj.ctx.clearRect(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
  };

  const setState = (state, data = {}) => {
    currentState = state;
    if (!elements.placeholder) return;
    
    elements.placeholder.classList.add('tw-hidden');
    elements.previewContainer.classList.add('tw-hidden');
    elements.controls.classList.add('tw-hidden');
    elements.spinner.classList.add('tw-hidden');
    if (elements.btnIcon) elements.btnIcon.classList.remove('tw-hidden');
    elements.errorDisplay.classList.add('tw-hidden');
    elements.generateBtn.disabled = false;
    elements.btnText.innerText = 'Editar com IA';

    switch (state) {
      case 'IDLE':
        elements.placeholder.classList.remove('tw-hidden');
        elements.fileInput.value = '';
        clearCanvas();
        break;
      case 'PREVIEW':
        elements.previewContainer.classList.remove('tw-hidden');
        elements.controls.classList.remove('tw-hidden');
        if (data.src) {
          elements.previewImg.src = data.src;
          originalImageForExtraction.src = data.src;
          elements.maskCanvas.width = 1024;
          elements.maskCanvas.height = 1024;
          clearCanvas();
        }
        break;
      case 'PROCESSING':
        elements.previewContainer.classList.remove('tw-hidden');
        elements.controls.classList.remove('tw-hidden');
        elements.spinner.classList.remove('tw-hidden');
        if (elements.btnIcon) elements.btnIcon.classList.add('tw-hidden');
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

  const getMousePos = (e) => {
    const rect = elements.maskCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (1024 / rect.width),
      y: (clientY - rect.top) * (1024 / rect.height)
    };
  };

  const startDrawing = (e) => {
    if (currentState !== 'PREVIEW') return;
    e.preventDefault();
    canvasObj.isDrawing = true;
    const { x, y } = getMousePos(e);
    canvasObj.lastX = x;
    canvasObj.lastY = y;
  };

  const draw = (e) => {
    if (!canvasObj.isDrawing || currentState !== 'PREVIEW') return;
    e.preventDefault();
    const { x, y } = getMousePos(e);
    const ctx = canvasObj.ctx;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = parseInt(elements.brushSize.value, 10);
    ctx.beginPath();
    ctx.moveTo(canvasObj.lastX, canvasObj.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    canvasObj.lastX = x;
    canvasObj.lastY = y;
  };

  if (elements.maskCanvas) {
    elements.maskCanvas.addEventListener('mousedown', startDrawing);
    elements.maskCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', () => canvasObj.isDrawing = false);
    elements.clearMask.addEventListener('click', clearCanvas);
  }

  const downloadBtn = document.getElementById('btn-download-editor');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const src = elements.previewImg.src;
      if (src && !src.includes('placeholder')) {
        const link = document.createElement('a');
        link.href = src;
        link.download = `edited-image-${Date.now()}.png`;
        link.click();
      }
    });
  }
  if (elements.uploader) elements.uploader.addEventListener('click', () => { if(currentState === 'IDLE') elements.fileInput.click(); });
  if (elements.removeBtn) elements.removeBtn.addEventListener('click', (e) => { e.stopPropagation(); setState('IDLE'); });
  if (elements.fileInput) elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setState('PREVIEW', { src: ev.target.result });
      reader.readAsDataURL(file);
    }
  });

  if (elements.generateBtn) elements.generateBtn.addEventListener('click', async () => {
    const promptValue = elements.promptInput.value.trim();
    if (!promptValue) return;

    setState('PROCESSING');
    try {
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = 1024; baseCanvas.height = 1024;
      const bCtx = baseCanvas.getContext('2d');
      bCtx.fillStyle = '#000'; bCtx.fillRect(0, 0, 1024, 1024);
      
      const ratio = Math.min(1024/originalImageForExtraction.width, 1024/originalImageForExtraction.height);
      const nw = originalImageForExtraction.width * ratio;
      const nh = originalImageForExtraction.height * ratio;
      bCtx.drawImage(originalImageForExtraction, (1024-nw)/2, (1024-nh)/2, nw, nh);

      const imageBlob = await new Promise(r => baseCanvas.toBlob(r, 'image/png'));
      const maskBlob = await new Promise(r => elements.maskCanvas.toBlob(r, 'image/png'));

      const formData = new FormData();
      formData.append('image', imageBlob);
      formData.append('mask', maskBlob);
      formData.append('prompt', promptValue);

      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no servidor');
      setState('PREVIEW', { src: data.url });
    } catch (err) {
      setState('ERROR', { message: err.message });
    }
  });
}
