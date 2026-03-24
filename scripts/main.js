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

  // CSS Classes extracted from the Original UI State
  const inactiveClasses = ['bg-tertiary', 'text-tertiary-foreground', 'hover:bg-tertiary-hover', 'active:bg-tertiary-hover'];
  const activeClasses = ['bg-gray-100', 'text-secondary-foreground', 'hover:bg-gray-200', 'active:bg-gray-200'];

  function switchView(viewName, activeButtonKey) {
    // 1. Esconder todos os painéis e desativar botões
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

    // 2. Mostrar o Painel Alvo
    const targetView = views[viewName];
    if (targetView) {
      if (viewName === 'imageEditor' || viewName === 'projects') {
        targetView.classList.remove('hidden', 'tw-hidden');
        targetView.style.display = 'block';
      } else {
        targetView.classList.remove('hidden', 'tw-hidden');
        targetView.classList.add('tw-flex');
        targetView.style.display = ''; // O uso do tw-flex já cuida do display
      }
    }

    // 3. Ativar esteticamente o Botão Alvo
    const targetBtn = buttons[activeButtonKey];
    if (targetBtn) {
       targetBtn.setAttribute('data-active', 'true');
       targetBtn.classList.remove(...inactiveClasses);
       targetBtn.classList.add(...activeClasses);
    }

    // 4. Executar lógicas específicas por view
    if (viewName === 'projects') {
      loadProjectsView();
    }
  }

  // Event Listeners
  if (buttons.projects) {
    buttons.projects.addEventListener('click', () => switchView('projects', 'projects'));
  }
  if (buttons.textToImage) {
    buttons.textToImage.addEventListener('click', () => switchView('textToImage', 'textToImage'));
  }
  if (buttons.imageToImage) {
    buttons.imageToImage.addEventListener('click', () => switchView('imageEditor', 'imageToImage'));
  }
  if (buttons.textToVideo) {
    buttons.textToVideo.addEventListener('click', () => switchView('video', 'textToVideo'));
  }
  if (buttons.imageToVideo) {
    buttons.imageToVideo.addEventListener('click', () => switchView('video', 'imageToVideo'));
  }
  if (buttons.faceswap) {
    buttons.faceswap.addEventListener('click', () => switchView('faceswap', 'faceswap'));
  }

  // Forçar Estado Inicial para esconder views excedentes no carregamento original
  switchView('imageEditor', 'imageToImage');
}

async function loadProjectsView() {
  const grid = document.getElementById('projects-grid');
  const emptyState = document.getElementById('projects-empty');
  if (!grid || !emptyState) return;

  grid.innerHTML = '<div class="tw-col-span-full tw-text-center tw-text-gray-500">Carregando projetos...</div>';
  emptyState.classList.add('tw-hidden');

  const token = localStorage.getItem('token');
  if (!token) {
    grid.innerHTML = '';
    emptyState.classList.remove('tw-hidden');
    return;
  }

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
            ${p.type === 'video' ? '<span class="tw-inline-block tw-mt-2 tw-bg-indigo-100 tw-text-indigo-800 tw-text-xs tw-px-2 tw-py-1 tw-rounded-full">Vídeo</span>' : ''}
            ${p.type === 'faceswap' ? '<span class="tw-inline-block tw-mt-2 tw-bg-pink-100 tw-text-pink-800 tw-text-xs tw-px-2 tw-py-1 tw-rounded-full">FaceSwap</span>' : ''}
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
 * SAAS: Video Generator
 */
function initVideoGenerator() {
  const btnGenerate = document.getElementById('btn-generate-video');
  const txtPrompt = document.getElementById('video-prompt');
  const fileInput = document.getElementById('video-file-input');
  const uploaderArea = document.getElementById('video-image-uploader');
  const previewImg = document.getElementById('video-preview-img');
  const promptArea = document.getElementById('video-upload-prompt');
  
  let selectedFile = null;

  if (!btnGenerate) return;

  uploaderArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        const url = URL.createObjectURL(selectedFile);
        previewImg.src = url;
        previewImg.classList.remove('tw-hidden');
        promptArea.classList.add('tw-hidden');
    }
  });

  btnGenerate.addEventListener('click', async () => {
      const prompt = txtPrompt.value.trim();
      const token = localStorage.getItem('token') || '';
      
      if (!prompt && !selectedFile) {
          alert('Por favor, envie uma imagem ou digite um prompt.');
          return;
      }

      btnGenerate.disabled = true;
      btnGenerate.innerHTML = '<span>Gerando (Pode levar alguns minutos)...</span>';

      const formData = new FormData();
      if (prompt) formData.append('prompt', prompt);
      if (selectedFile) formData.append('image', selectedFile);

      try {
        const res = await fetch('/api/video/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            alert('Vídeo gerado/enviado para processamento! Verifique seus projetos em alguns minutos.');
            initAuthData(); // Atualiza saldo
            txtPrompt.value = '';
            selectedFile = null;
            previewImg.classList.add('tw-hidden');
            promptArea.classList.remove('tw-hidden');
        } else {
          throw new Error(data.error || 'Erro na API de Vídeo');
        }
      } catch (err) {
          alert(err.message);
      } finally {
          btnGenerate.disabled = false;
          btnGenerate.innerHTML = '<span>Gerar Vídeo</span>';
      }
  });
}

/**
 * SAAS: FaceSwap Generator
 */
function initFaceSwapGenerator() {
   const btnGenerate = document.getElementById('btn-generate-faceswap');
   const inputTarget = document.getElementById('faceswap-target-input');
   const inputSource = document.getElementById('faceswap-source-input');
   const previewTarget = document.getElementById('faceswap-target-preview');
   const previewSource = document.getElementById('faceswap-source-preview');
   const promptTarget = document.getElementById('faceswap-target-prompt');
   const promptSource = document.getElementById('faceswap-source-prompt');

   let targetFile = null;
   let sourceFile = null;

   if (!btnGenerate) return;

   document.getElementById('faceswap-target-uploader').addEventListener('click', () => inputTarget.click());
   document.getElementById('faceswap-source-uploader').addEventListener('click', () => inputSource.click());

   inputTarget.addEventListener('change', (e) => {
       if (e.target.files && e.target.files.length > 0) {
           targetFile = e.target.files[0];
           previewTarget.src = URL.createObjectURL(targetFile);
           previewTarget.classList.remove('tw-hidden');
           promptTarget.classList.add('tw-hidden');
       }
   });

   inputSource.addEventListener('change', (e) => {
       if (e.target.files && e.target.files.length > 0) {
           sourceFile = e.target.files[0];
           previewSource.src = URL.createObjectURL(sourceFile);
           previewSource.classList.remove('tw-hidden');
           promptSource.classList.add('tw-hidden');
       }
   });

   btnGenerate.addEventListener('click', async () => {
       if (!targetFile || !sourceFile) {
           alert('Você precisa enviar ambas as imagens: o corpo e o rosto.');
           return;
       }

       const token = localStorage.getItem('token') || '';
       btnGenerate.disabled = true;
       btnGenerate.innerHTML = '<span>Processando...</span>';

       const formData = new FormData();
       formData.append('target_image', targetFile);
       formData.append('swap_image', sourceFile);

       try {
         const res = await fetch('/api/faceswap/generate', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${token}`
           },
           body: formData
         });
         
         const data = await res.json();
         
         if (res.ok && data.success) {
             alert('FaceSwap Concluído com Sucesso! O resultado foi salvo em seus Projetos.');
             initAuthData(); // Atualiza saldo
             
             // Reset
             targetFile = null;
             sourceFile = null;
             previewTarget.classList.add('tw-hidden');
             previewSource.classList.add('tw-hidden');
             promptTarget.classList.remove('tw-hidden');
             promptSource.remove('tw-hidden');
         } else {
           throw new Error(data.error || 'Erro na API de FaceSwap');
         }
       } catch (err) {
           alert(err.message);
       } finally {
           btnGenerate.disabled = false;
           btnGenerate.innerHTML = '<span>Fundir Rostos</span>';
       }
   });
}

async function initAuthData() {
  const token = localStorage.getItem('token');
  const creditsEl = document.getElementById('auth-credits');
  
  if (!token) {
    if (creditsEl) creditsEl.innerText = 'Login required';
    return;
  }

  try {
    const res = await fetch('/api/user/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && creditsEl) {
      creditsEl.innerText = data.user.credits;
    } else {
      if (creditsEl) creditsEl.innerText = '0 (Error)';
    }
  } catch (err) {
    if (creditsEl) creditsEl.innerText = 'Offline';
  }
}

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
 * Refactored for stability, VEED-style premium UX, and DALL-E 2 interactive masking.
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
    btnText: document.getElementById('btn-text'),
    spinner: document.getElementById('loading-spinner'),
    errorDisplay: document.getElementById('error-message'),
    brushSize: document.getElementById('brush-size'),
    clearMask: document.getElementById('clear-mask')
  };

  const canvasObj = {
    ctx: elements.maskCanvas.getContext('2d'),
    isDrawing: false,
    lastX: 0,
    lastY: 0
  };

  // State Management
  let currentState = 'IDLE'; // IDLE, PREVIEW, PROCESSING
  let originalImageForExtraction = new Image(); // Hidden image to avoid cross-origin issues during draw
  originalImageForExtraction.crossOrigin = "anonymous"; // Resolves Tainted Canvas issues

  const clearCanvas = () => {
    canvasObj.ctx.clearRect(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
  };

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
        clearCanvas();
        break;

      case 'PREVIEW':
        elements.previewContainer.classList.remove('tw-hidden');
        elements.controls.classList.remove('tw-hidden');
        if (data.src) {
          elements.previewImg.src = data.src;
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { originalImageForExtraction = img; };
          img.src = data.src;
          
          // Lock canvas resolution to 1024x1024 for DALL-E 2 high-res precision
          elements.maskCanvas.width = 1024;
          elements.maskCanvas.height = 1024;
          clearCanvas();
        }
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

  // --- DRAWING LOGIC ---
  const getMousePos = (e) => {
    const rect = elements.maskCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale to the 1024x1024 internal coordinate system
    const x = (clientX - rect.left) * (1024 / rect.width);
    const y = (clientY - rect.top) * (1024 / rect.height);
    
    return { x, y };
  };

  // Helper to apply Gaussian Blur to the mask for professional blending
  const applyBlur = (ctx, radius) => {
    const canvas = ctx.canvas;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');
    
    tCtx.filter = `blur(${radius}px)`;
    tCtx.drawImage(canvas, 0, 0);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const startDrawing = (e) => {
    if (currentState !== 'PREVIEW') return;
    e.preventDefault();
    canvasObj.isDrawing = true;
    const { x, y } = getMousePos(e);
    canvasObj.lastX = x;
    canvasObj.lastY = y;
    draw(e); // Draw a dot even if no movement
  };

  const draw = (e) => {
    if (!canvasObj.isDrawing || currentState !== 'PREVIEW') return;
    e.preventDefault();
    const { x, y } = getMousePos(e);
    const ctx = canvasObj.ctx;
    
    // Visual green tint
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Tailwind Blue-500 semi-transparent
    ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
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

  const stopDrawing = () => {
    canvasObj.isDrawing = false;
  };

  elements.maskCanvas.addEventListener('mousedown', startDrawing);
  elements.maskCanvas.addEventListener('mousemove', draw);
  elements.maskCanvas.addEventListener('mouseup', stopDrawing);
  elements.maskCanvas.addEventListener('mouseleave', stopDrawing);
  
  elements.maskCanvas.addEventListener('touchstart', startDrawing, { passive: false });
  elements.maskCanvas.addEventListener('touchmove', draw, { passive: false });
  elements.maskCanvas.addEventListener('touchend', stopDrawing);

  elements.clearMask.addEventListener('click', (e) => {
    e.preventDefault();
    clearCanvas();
  });

  // --- EVENTS ---
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


  // --- EXTRACTION PIPELINE ---
  elements.generateBtn.addEventListener('click', async () => {
    const promptValue = elements.promptInput.value.trim();

    if (!promptValue) {
      elements.promptInput.focus();
      elements.promptInput.classList.add('tw-ring-red-400');
      setTimeout(() => elements.promptInput.classList.remove('tw-ring-red-400'), 2000);
      return;
    }

    setState('PROCESSING');

    try {
      // 1. Generate 1024x1024 Base Image using "FIT" (Padding)
      // This ensures 100% of the original image is preserved and visible.
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = 1024;
      baseCanvas.height = 1024;
      const bCtx = baseCanvas.getContext('2d');
      
      // Fill background with black
      bCtx.fillStyle = '#000000';
      bCtx.fillRect(0, 0, 1024, 1024);
      
      // Calculate "Fit" (Contain) math
      const imgTarget = originalImageForExtraction;
      const hRatio = 1024 / imgTarget.width;
      const vRatio = 1024 / imgTarget.height;
      const ratio = Math.min(hRatio, vRatio);
      
      const nw = imgTarget.width * ratio;
      const nh = imgTarget.height * ratio;
      const ox = (1024 - nw) / 2;
      const oy = (1024 - nh) / 2;
      
      bCtx.drawImage(imgTarget, ox, oy, nw, nh);

      // 2. Criação da máscara P&B isolada para Stability AI
      const maskCanvasExport = document.createElement('canvas');
      maskCanvasExport.width = 1024;
      maskCanvasExport.height = 1024;
      const mCtx = maskCanvasExport.getContext('2d');
      
      // Fundo preto (Stability: áreas para MANTÉM)
      mCtx.fillStyle = '#000000';
      mCtx.fillRect(0, 0, 1024, 1024);
      
      // Pegar dados desenhados pelo usuário
      const tempMaskCanvas = document.createElement('canvas');
      tempMaskCanvas.width = 1024;
      tempMaskCanvas.height = 1024;
      const tCtx = tempMaskCanvas.getContext('2d');
      tCtx.drawImage(elements.maskCanvas, 0, 0);
      const userDrawData = tCtx.getImageData(0, 0, 1024, 1024);
      
      const finalMaskData = mCtx.getImageData(0, 0, 1024, 1024);
      
      let hasHoles = false;
      for (let i = 0; i < userDrawData.data.length; i += 4) {
        if (userDrawData.data[i + 3] > 10) { 
          // Area pintada pelo usuário -> Branco (Stability: APAGA/ERASE)
          finalMaskData.data[i] = 255;     // R
          finalMaskData.data[i + 1] = 255; // G
          finalMaskData.data[i + 2] = 255; // B
          finalMaskData.data[i + 3] = 255; // Alpha
          hasHoles = true;
        }
      }

      if (!hasHoles) {
         throw new Error("A máscara está vazia. Pinte a área da imagem que deseja remover.");
      }

      // Aplica os pixels da máscara sobre o fundo preto
      mCtx.putImageData(finalMaskData, 0, 0);

      // Converter em Blobs para o FormData
      const imageBlob = await new Promise(resolve => baseCanvas.toBlob(resolve, 'image/png'));
      const maskBlob = await new Promise(resolve => maskCanvasExport.toBlob(resolve, 'image/png'));

      const formData = new FormData();
      formData.append('image', imageBlob, 'image.png'); 
      formData.append('mask', maskBlob, 'mask.png'); 
      formData.append('prompt', promptValue);

      const token = localStorage.getItem('token') || '';
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no servidor.');
      }

      if (data.url) {
        setState('PREVIEW', { src: data.url });
        elements.previewImg.classList.add('tw-ring-4', 'tw-ring-green-400');
        setTimeout(() => elements.previewImg.classList.remove('tw-ring-4', 'tw-ring-green-400'), 3000);
      }
    } catch (err) {
      console.error('[Editor API Error]', err);
      setState('ERROR', { message: err.message });
    }
  });
}

/**
 * SAAS: Video Generator Controller (Async Polling)
 */
function initVideoModal() {
  const btnOpen = document.getElementById('btn-open-video');
  const btnClose = document.getElementById('close-video-modal');
  const modal = document.getElementById('video-modal');
  const btnAction = document.getElementById('btn-do-video');
  const fileInput = document.getElementById('vid-image');
  const divLoading = document.getElementById('vid-loading');
  const txtStatus = document.getElementById('vid-status-text');
  const divResult = document.getElementById('vid-result');
  const vidPreview = document.getElementById('vid-preview');
  const divError = document.getElementById('vid-error');

  if (!btnOpen || !modal) return;

  btnOpen.addEventListener('click', () => {
    modal.classList.remove('tw-hidden');
    modal.classList.add('tw-flex');
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('tw-hidden');
      modal.classList.remove('tw-flex');
    });
  }

  if (btnAction) {
    btnAction.addEventListener('click', async () => {
      const file = fileInput.files[0];
      if (!file) {
        divError.innerText = 'Selecione uma imagem!';
        divError.classList.remove('tw-hidden');
        return;
      }

      const token = localStorage.getItem('token') || '';
      
      btnAction.disabled = true;
      btnAction.classList.add('tw-opacity-50');
      divResult.classList.add('tw-hidden');
      divError.classList.add('tw-hidden');
      divLoading.classList.remove('tw-hidden');
      txtStatus.innerText = 'Submetendo job...';

      const formData = new FormData();
      formData.append('image', file);

      try {
        // PASSO 1: Submit
        const resSubmit = await fetch('/api/video/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        const dataSubmit = await resSubmit.json();
        if (!resSubmit.ok || !dataSubmit.success) {
          throw new Error(dataSubmit.error || 'Erro ao submeter vídeo.');
        }

        const generationId = dataSubmit.generation_id;
        txtStatus.innerText = 'Job criado na Nuvem. Iniciando rendering (pode levar minutos)...';

        // PASSO 2: Polling
        let loopCount = 0;
        const pollInterval = setInterval(async () => {
          loopCount++;
          txtStatus.innerText = `Checando status (Tentativa ${loopCount})...`;
          
          try {
            const resPoll = await fetch(`/api/video/status/${generationId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (resPoll.status === 202) {
              // Ainda processando
              return;
            }
            
            const dataPoll = await resPoll.json();
            if (resPoll.ok && dataPoll.status === 'finished') {
              clearInterval(pollInterval);
              vidPreview.src = dataPoll.url;
              divLoading.classList.add('tw-hidden');
              divResult.classList.remove('tw-hidden');
              btnAction.disabled = false;
              btnAction.classList.remove('tw-opacity-50');
              initAuthData(); // Atualiza creditos -5
            } else {
              clearInterval(pollInterval);
              throw new Error(dataPoll.error || 'Falha no processamento.');
            }
          } catch (pollErr) {
            clearInterval(pollInterval);
            divLoading.classList.add('tw-hidden');
            divError.innerText = pollErr.message;
            divError.classList.remove('tw-hidden');
            btnAction.disabled = false;
            btnAction.classList.remove('tw-opacity-50');
          }
        }, 10000); // 10s poll

      } catch (err) {
        divLoading.classList.add('tw-hidden');
        divError.innerText = err.message;
        divError.classList.remove('tw-hidden');
        btnAction.disabled = false;
        btnAction.classList.remove('tw-opacity-50');
      }
    });
  }
}

/**
 * SAAS: Face Swap Controller (Sync Wait - Inline Polling on backend)
 */
function initFaceSwapModal() {
  const btnOpen = document.getElementById('btn-open-faceswap');
  const btnClose = document.getElementById('close-faceswap-modal');
  const modal = document.getElementById('faceswap-modal');
  const btnAction = document.getElementById('btn-do-faceswap');
  const fileTarget = document.getElementById('fs-target');
  const fileSwap = document.getElementById('fs-swap');
  const divLoading = document.getElementById('fs-loading');
  const divResult = document.getElementById('fs-result');
  const imgPreview = document.getElementById('fs-preview');
  const divError = document.getElementById('fs-error');

  if (!btnOpen || !modal) return;

  btnOpen.addEventListener('click', () => {
    modal.classList.remove('tw-hidden');
    modal.classList.add('tw-flex');
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('tw-hidden');
      modal.classList.remove('tw-flex');
    });
  }

  if (btnAction) {
    btnAction.addEventListener('click', async () => {
      const fTarget = fileTarget.files[0];
      const fSwap = fileSwap.files[0];
      if (!fTarget || !fSwap) {
        divError.innerText = 'Selecione ambas as imagens!';
        divError.classList.remove('tw-hidden');
        return;
      }

      const token = localStorage.getItem('token') || '';
      
      btnAction.disabled = true;
      btnAction.classList.add('tw-opacity-50');
      divResult.classList.add('tw-hidden');
      divError.classList.add('tw-hidden');
      divLoading.classList.remove('tw-hidden');

      const formData = new FormData();
      formData.append('target_image', fTarget);
      formData.append('swap_image', fSwap);

      try {
        const res = await fetch('/api/faceswap/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao processar Face Swap.');
        }

        imgPreview.src = data.url;
        divLoading.classList.add('tw-hidden');
        divResult.classList.remove('tw-hidden');
        initAuthData(); // Atualiza creditos -2
      } catch (err) {
        divLoading.classList.add('tw-hidden');
        divError.innerText = err.message;
        divError.classList.remove('tw-hidden');
      } finally {
        btnAction.disabled = false;
        btnAction.classList.remove('tw-opacity-50');
      }
    });
  }
}
// EOF: main.js


/**
 * SAAS: Text-To-Image Generator
 */
function initText2ImgGenerator() {
   const btnGenerate = document.getElementById('btn-generate-t2i');
   const txtPrompt = document.getElementById('t2i-prompt');
   const previewImg = document.getElementById('t2i-preview-img');
   const placeholder = document.getElementById('t2i-placeholder');
   const errorDiv = document.getElementById('t2i-error');

   if (!btnGenerate) return;

   btnGenerate.addEventListener('click', async () => {
       const prompt = txtPrompt.value.trim();
       if (!prompt) return;

       const token = localStorage.getItem('token') || '';
       
       btnGenerate.disabled = true;
       btnGenerate.innerHTML = '<span>Gerando...</span>';
       errorDiv.classList.add('tw-hidden');

       const formData = new FormData();
       formData.append('prompt', prompt);

       try {
         const res = await fetch('/api/generate', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${token}`
           },
           body: formData
         });
         
         const data = await res.json();
         
         if (res.ok && data.success) {
             previewImg.src = data.url;
             previewImg.classList.remove('tw-hidden');
             placeholder.classList.add('tw-hidden');
             initAuthData();
         } else {
           throw new Error(data.error || 'Erro na API');
         }
       } catch (err) {
           errorDiv.innerText = err.message;
           errorDiv.classList.remove('tw-hidden');
       } finally {
           btnGenerate.disabled = false;
           btnGenerate.innerHTML = '<span>Gerar Imagem</span>';
       }
   });
}
