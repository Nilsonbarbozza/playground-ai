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
        elements.previewImg.classList.add('tw-ring-4', 'tw-ring-green-400');
        setTimeout(() => elements.previewImg.classList.remove('tw-ring-4', 'tw-ring-green-400'), 3000);
      }
    } catch (err) {
      console.error('[Editor API Error]', err);
      setState('ERROR', { message: err.message });
    }
  });
}
// EOF: main.js
