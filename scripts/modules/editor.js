import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';
import { telemetry } from '../services/telemetry.js';

/**
 * Image Editor Module (Level 3)
 * Ported from main.js with modular improvements.
 */
export const editor = {
  elements: {},
  canvasObj: { ctx: null, isDrawing: false, lastX: 0, lastY: 0 },
  activeTool: 'brush',
  maskHistory: [],
  maxHistory: 20,
  viewport: {
    scale: 1,
    tx: 0,
    ty: 0,
    minScale: 0.5,
    maxScale: 4,
    isPanning: false,
    panStartX: 0,
    panStartY: 0
  },
  previewObjectUrl: null,
  previewFile: null,
  previewLoadTimer: null,
  previewLoadTimeoutMs: 3500,
  lastPreviewSrc: null,
  lastPreviewIsBlob: false,
  previewRetryCount: 0,
  previewLoadInFlight: false,
  currentState: 'IDLE',
  originalImage: new Image(),

  init() {
    this.originalImage.crossOrigin = "anonymous";
    this.mapElements();
    if (!this.elements.generateBtn) return;
    
    this.initCanvas();
    this.initListeners();
    console.log('[Editor] Initialized');
  },

  mapElements() {
    this.elements = {
      uploader: document.getElementById('uploader-container'),
      placeholder: document.getElementById('uploader-placeholder'),
      previewContainer: document.getElementById('preview-container'),
      previewImg: document.getElementById('preview-img'),
      previewFallback: document.getElementById('preview-fallback'),
      previewFallbackText: document.getElementById('preview-fallback-text'),
      previewFallbackReload: document.getElementById('preview-fallback-reload'),
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
      brushSizeValue: document.getElementById('brush-size-value'),
      toolBrush: document.getElementById('tool-brush'),
      toolEraser: document.getElementById('tool-eraser'),
      toolPan: document.getElementById('tool-pan'),
      zoomInBtn: document.getElementById('zoom-in-btn'),
      zoomOutBtn: document.getElementById('zoom-out-btn'),
      zoomResetBtn: document.getElementById('zoom-reset-btn'),
      zoomLevel: document.getElementById('zoom-level'),
      undoMask: document.getElementById('undo-mask'),
      clearMask: document.getElementById('clear-mask'),
      downloadBtn: document.getElementById('btn-download-editor')
    };
    if (this.elements.maskCanvas) {
      this.canvasObj.ctx = this.elements.maskCanvas.getContext('2d');
    }
  },

  setState(state, data = {}) {
    this.currentState = state;
    const el = this.elements;
    
    el.placeholder.classList.add('tw-hidden');
    el.previewContainer.classList.add('tw-hidden');
    el.controls.classList.add('tw-hidden');
    el.spinner.classList.add('tw-hidden');
    if (el.btnIcon) el.btnIcon.classList.remove('tw-hidden');
    el.errorDisplay.classList.add('tw-hidden');
    el.generateBtn.disabled = false;
    el.btnText.innerText = 'Editar com IA';

    switch (state) {
      case 'IDLE':
        this.clearPreviewObjectUrl();
        this.previewFile = null;
        this.previewRetryCount = 0;
        this.previewLoadInFlight = false;
        this.clearPreviewLoadWatch();
        this.hidePreviewFallback();
        el.placeholder.classList.remove('tw-hidden');
        el.fileInput.value = '';
        this.clearCanvas(true);
        this.resetViewport();
        break;
      case 'PREVIEW':
        el.previewContainer.classList.remove('tw-hidden');
        el.controls.classList.remove('tw-hidden');
        if (data.src) {
          this.loadPreviewSource(data.src, { resetEditor: data.resetEditor !== false });
        }
        break;
      case 'PROCESSING':
        el.previewContainer.classList.remove('tw-hidden');
        el.controls.classList.remove('tw-hidden');
        el.spinner.classList.remove('tw-hidden');
        if (el.btnIcon) el.btnIcon.classList.add('tw-hidden');
        el.generateBtn.disabled = true;
        el.btnText.innerText = 'Processando...';
        break;
      case 'ERROR':
        el.previewContainer.classList.remove('tw-hidden');
        el.controls.classList.remove('tw-hidden');
        el.errorDisplay.classList.remove('tw-hidden');
        el.errorDisplay.innerText = data.message || 'Erro inesperado.';
        break;
    }
  },

  clearPreviewObjectUrl() {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  },

  clearPreviewLoadWatch() {
    if (this.previewLoadTimer) {
      clearTimeout(this.previewLoadTimer);
      this.previewLoadTimer = null;
    }
    if (this.elements.previewImg) {
      this.elements.previewImg.onload = null;
      this.elements.previewImg.onerror = null;
    }
    this.previewLoadInFlight = false;
  },

  hidePreviewFallback() {
    if (this.elements.previewFallback) this.elements.previewFallback.classList.add('tw-hidden');
  },

  showPreviewFallback(message) {
    if (this.elements.previewFallbackText) {
      this.elements.previewFallbackText.innerText = message || 'Preview indisponivel.';
    }
    if (this.elements.previewFallback) {
      this.elements.previewFallback.classList.remove('tw-hidden');
    }
  },

  trackPreviewEvent(eventName, extraProps = {}) {
    telemetry.track(eventName, {
      route_or_feature: 'image-editor',
      props: {
        source_kind: this.lastPreviewIsBlob ? 'blob' : 'url',
        retry_count: this.previewRetryCount,
        zoom_percent: Math.round(this.viewport.scale * 100),
        ...extraProps
      }
    });
  },

  loadPreviewSource(src, { resetEditor = true } = {}) {
    const { previewImg, maskCanvas } = this.elements;
    if (!previewImg || !maskCanvas) return;

    if (this.previewObjectUrl && !String(src).startsWith('blob:')) {
      this.clearPreviewObjectUrl();
    }

    this.clearPreviewLoadWatch();
    this.hidePreviewFallback();
    this.lastPreviewSrc = src;
    this.lastPreviewIsBlob = String(src).startsWith('blob:');
    this.previewLoadInFlight = true;

    previewImg.onload = () => {
      this.clearPreviewLoadWatch();
      this.hidePreviewFallback();
      this.trackPreviewEvent('editor_preview_loaded', {
        natural_width: previewImg.naturalWidth || null,
        natural_height: previewImg.naturalHeight || null
      });
    };
    previewImg.onerror = () => {
      this.clearPreviewLoadWatch();
      this.showPreviewFallback('Falha ao carregar preview.');
      this.trackPreviewEvent('editor_preview_load_error', {
        reason: 'img_onerror'
      });
    };
    this.previewLoadTimer = setTimeout(() => {
      if (!previewImg.complete || previewImg.naturalWidth === 0) {
        this.showPreviewFallback('Preview demorou para carregar.');
        this.trackPreviewEvent('editor_preview_timeout', {
          timeout_ms: this.previewLoadTimeoutMs
        });
      }
    }, this.previewLoadTimeoutMs);

    previewImg.src = src;
    this.originalImage.src = src;

    if (resetEditor) {
      maskCanvas.width = 1024;
      maskCanvas.height = 1024;
      this.clearCanvas(true);
      this.resetViewport();
    }
  },

  retryPreviewLoad() {
    if (!this.lastPreviewSrc && !this.previewFile) return;
    this.previewRetryCount += 1;
    this.trackPreviewEvent('editor_preview_retry_click');

    if (this.lastPreviewIsBlob && this.previewFile) {
      this.clearPreviewObjectUrl();
      this.previewObjectUrl = URL.createObjectURL(this.previewFile);
      this.lastPreviewSrc = this.previewObjectUrl;
      this.lastPreviewIsBlob = true;
      this.loadPreviewSource(this.previewObjectUrl, { resetEditor: false });
      return;
    }

    const baseSrc = String(this.lastPreviewSrc || '');
    if (!baseSrc) return;
    const cacheBust = `cb=${Date.now()}`;
    const nextSrc = baseSrc.includes('?') ? `${baseSrc}&${cacheBust}` : `${baseSrc}?${cacheBust}`;
    this.lastPreviewSrc = nextSrc;
    this.lastPreviewIsBlob = false;
    this.loadPreviewSource(nextSrc, { resetEditor: false });
  },

  initCanvas() {
    const cvs = this.elements.maskCanvas;
    if (!cvs) return;
    cvs.style.touchAction = 'none';

    const getMousePos = (e) => {
      const rect = cvs.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      return {
        x: (clientX - rect.left) * (1024 / rect.width),
        y: (clientY - rect.top) * (1024 / rect.height)
      };
    };

    const startDrawing = (e) => {
      if (this.currentState !== 'PREVIEW') return;
      e.preventDefault();
      if (this.activeTool === 'pan') {
        this.viewport.isPanning = true;
        this.viewport.panStartX = e.clientX - this.viewport.tx;
        this.viewport.panStartY = e.clientY - this.viewport.ty;
        this.syncToolUI();
        return;
      }
      this.canvasObj.isDrawing = true;
      this.saveHistory();
      const { x, y } = getMousePos(e);
      this.canvasObj.lastX = x;
      this.canvasObj.lastY = y;
    };

    const draw = (e) => {
      if (!this.canvasObj.isDrawing || this.currentState !== 'PREVIEW') return;
      e.preventDefault();
      const { x, y } = getMousePos(e);
      const ctx = this.canvasObj.ctx;
      if (!ctx) return;
      ctx.globalCompositeOperation = this.activeTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = this.activeTool === 'eraser' ? 'rgba(0,0,0,1)' : 'rgba(59, 130, 246, 0.5)';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = parseInt(this.elements.brushSize.value, 10);
      ctx.beginPath();
      ctx.moveTo(this.canvasObj.lastX, this.canvasObj.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      this.canvasObj.lastX = x;
      this.canvasObj.lastY = y;
    };

    const stopDrawing = () => {
      this.canvasObj.isDrawing = false;
      if (this.viewport.isPanning) {
        this.viewport.isPanning = false;
        this.syncToolUI();
      }
    };

    const panMove = (e) => {
      if (!this.viewport.isPanning || this.currentState !== 'PREVIEW') return;
      e.preventDefault();
      this.viewport.tx = e.clientX - this.viewport.panStartX;
      this.viewport.ty = e.clientY - this.viewport.panStartY;
      this.applyViewportTransform();
    };

    const onWheelZoom = (e) => {
      if (this.currentState !== 'PREVIEW') return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAtPoint(factor, e.clientX, e.clientY);
    };

    cvs.addEventListener('pointerdown', startDrawing);
    cvs.addEventListener('pointermove', draw);
    cvs.addEventListener('pointermove', panMove);
    cvs.addEventListener('wheel', onWheelZoom, { passive: false });
    window.addEventListener('pointerup', stopDrawing);
    cvs.addEventListener('pointerleave', stopDrawing);

    this.elements.clearMask.onclick = () => this.clearCanvas(true);
    if (this.elements.undoMask) this.elements.undoMask.onclick = () => this.undoMask();
    if (this.elements.toolBrush) this.elements.toolBrush.onclick = () => this.setTool('brush');
    if (this.elements.toolEraser) this.elements.toolEraser.onclick = () => this.setTool('eraser');
    if (this.elements.toolPan) this.elements.toolPan.onclick = () => this.setTool('pan');
    if (this.elements.zoomInBtn) this.elements.zoomInBtn.onclick = () => this.zoomAtCenter(1.1);
    if (this.elements.zoomOutBtn) this.elements.zoomOutBtn.onclick = () => this.zoomAtCenter(0.9);
    if (this.elements.zoomResetBtn) this.elements.zoomResetBtn.onclick = () => this.resetViewport();
    if (this.elements.brushSize) {
      this.elements.brushSize.oninput = () => {
        if (this.elements.brushSizeValue) {
          this.elements.brushSizeValue.innerText = `${this.elements.brushSize.value}px`;
        }
      };
      if (this.elements.brushSizeValue) {
        this.elements.brushSizeValue.innerText = `${this.elements.brushSize.value}px`;
      }
    }
    this.syncToolUI();
  },

  setTool(tool) {
    this.activeTool = ['brush', 'eraser', 'pan'].includes(tool) ? tool : 'brush';
    this.viewport.isPanning = false;
    this.syncToolUI();
  },

  syncToolUI() {
    const { toolBrush, toolEraser, toolPan, maskCanvas } = this.elements;
    if (!toolBrush || !toolEraser || !toolPan) return;
    const setActiveState = (button, isActive) => {
      button.classList.toggle('tw-border-blue-600', isActive);
      button.classList.toggle('tw-text-blue-700', isActive);
      button.classList.toggle('tw-bg-blue-50', isActive);

      button.classList.toggle('tw-border-slate-300', !isActive);
      button.classList.toggle('tw-text-slate-700', !isActive);
      button.classList.toggle('tw-bg-white', !isActive);
    };

    const brushOn = this.activeTool === 'brush';
    const eraserOn = this.activeTool === 'eraser';
    const panOn = this.activeTool === 'pan';
    setActiveState(toolBrush, brushOn);
    setActiveState(toolEraser, eraserOn);
    setActiveState(toolPan, panOn);

    if (maskCanvas) {
      const brushCursor =
        'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%231e40af\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M15.2 5.2l3.6 3.6M16.7 3.7a2.5 2.5 0 1 1 3.6 3.6L6.5 21H3v-3.5L16.7 3.7z\'/></svg>") 2 20, crosshair';
      const eraserCursor =
        'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230f172a\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M20 20H7l-4-4 9-9 8 8-5 5z\'/><path d=\'M13 7l4 4\'/></svg>") 2 20, crosshair';

      if (panOn && this.viewport.isPanning) maskCanvas.style.cursor = 'grabbing';
      else if (panOn) maskCanvas.style.cursor = 'grab';
      else if (eraserOn) maskCanvas.style.cursor = eraserCursor;
      else maskCanvas.style.cursor = brushCursor;
    }
  },

  applyViewportTransform() {
    const { previewImg, maskCanvas } = this.elements;
    if (!previewImg || !maskCanvas) return;
    const transform = `translate(${this.viewport.tx}px, ${this.viewport.ty}px) scale(${this.viewport.scale})`;
    previewImg.style.transform = transform;
    maskCanvas.style.transform = transform;
    previewImg.style.transformOrigin = 'center center';
    maskCanvas.style.transformOrigin = 'center center';
    if (this.elements.zoomLevel) {
      this.elements.zoomLevel.innerText = `${Math.round(this.viewport.scale * 100)}%`;
    }
  },

  zoomAtCenter(factor) {
    const rect = this.elements.previewContainer?.getBoundingClientRect();
    if (!rect) return;
    this.zoomAtPoint(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  },

  zoomAtPoint(factor, clientX, clientY) {
    const container = this.elements.previewContainer;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const nextScale = Math.max(this.viewport.minScale, Math.min(this.viewport.maxScale, this.viewport.scale * factor));
    if (Math.abs(nextScale - this.viewport.scale) < 0.0001) return;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - this.viewport.tx) / this.viewport.scale;
    const worldY = (localY - this.viewport.ty) / this.viewport.scale;

    this.viewport.scale = nextScale;
    this.viewport.tx = localX - worldX * nextScale;
    this.viewport.ty = localY - worldY * nextScale;
    this.applyViewportTransform();
  },

  resetViewport() {
    this.viewport.scale = 1;
    this.viewport.tx = 0;
    this.viewport.ty = 0;
    this.viewport.isPanning = false;
    this.applyViewportTransform();
    this.syncToolUI();
  },

  saveHistory() {
    if (!this.canvasObj.ctx || !this.elements.maskCanvas) return;
    try {
      const snapshot = this.canvasObj.ctx.getImageData(0, 0, this.elements.maskCanvas.width, this.elements.maskCanvas.height);
      this.maskHistory.push(snapshot);
      if (this.maskHistory.length > this.maxHistory) this.maskHistory.shift();
    } catch {
      // Ignore history failures; editing should continue.
    }
  },

  undoMask() {
    const snapshot = this.maskHistory.pop();
    if (!snapshot || !this.canvasObj.ctx) return;
    this.canvasObj.ctx.putImageData(snapshot, 0, 0);
  },

  clearCanvas(resetHistory = false) {
    if (this.canvasObj.ctx) {
      this.canvasObj.ctx.clearRect(0, 0, this.elements.maskCanvas.width, this.elements.maskCanvas.height);
      this.canvasObj.ctx.globalCompositeOperation = 'source-over';
    }
    if (resetHistory) {
      this.maskHistory = [];
    }
  },

  hasMaskSelection() {
    const canvas = this.elements.maskCanvas;
    const ctx = this.canvasObj.ctx;
    if (!canvas || !ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  },

  initListeners() {
    const el = this.elements;
    
    el.uploader.onclick = () => { if(this.currentState === 'IDLE') el.fileInput.click(); };
    el.removeBtn.onclick = (e) => { e.stopPropagation(); this.setState('IDLE'); };
    if (el.previewFallbackReload) {
      el.previewFallbackReload.onclick = () => this.retryPreviewLoad();
    }
    
    el.fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.clearPreviewObjectUrl();
        this.previewFile = file;
        this.previewObjectUrl = URL.createObjectURL(file);
        this.setState('PREVIEW', { src: this.previewObjectUrl });
      }
    };

    el.generateBtn.onclick = async () => this.handleGenerate();

    if (el.downloadBtn) {
      el.downloadBtn.onclick = () => {
        const src = el.previewImg.src;
        if (src && !src.includes('placeholder')) {
          const a = document.createElement('a');
          a.href = src;
          a.download = `edited-image-${Date.now()}.png`;
          a.click();
        }
      };
    }
  },

  async handleGenerate() {
    const promptValue = this.elements.promptInput.value.trim();
    const hasMask = this.hasMaskSelection();

    if (!promptValue && hasMask) {
      this.setState('ERROR', { message: 'Adicione um prompt para usar a mascara.' });
      return;
    }

    if (promptValue && !hasMask) {
      this.setState('ERROR', { message: 'Pinte a area da mascara antes de gerar a edicao.' });
      return;
    }

    if (!promptValue) {
      this.setState('ERROR', { message: 'Digite um prompt para a edicao.' });
      return;
    }

    this.setState('PROCESSING');

    try {
      // Prepare 1024x1024 square image for AI
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = 1024; 
      baseCanvas.height = 1024;
      const bCtx = baseCanvas.getContext('2d');
      bCtx.fillStyle = '#000'; 
      bCtx.fillRect(0, 0, 1024, 1024);
      
      const ratio = Math.min(1024/this.originalImage.width, 1024/this.originalImage.height);
      const nw = this.originalImage.width * ratio;
      const nh = this.originalImage.height * ratio;
      bCtx.drawImage(this.originalImage, (1024-nw)/2, (1024-nh)/2, nw, nh);

      const imageBlob = await new Promise(r => baseCanvas.toBlob(r, 'image/png'));
      const maskBlob = await new Promise(r => this.elements.maskCanvas.toBlob(r, 'image/png'));

      const formData = new FormData();
      formData.append('image', imageBlob);
      formData.append('mask', maskBlob);
      formData.append('prompt', promptValue);

      // Call API Service
      const data = await api.post('/edit', formData, true);
      
      this.setState('PREVIEW', { src: data.url });
      auth.refreshUser(); // Refresh credits
      ui.showToast('Imagem editada com sucesso!');

    } catch (err) {
      this.setState('ERROR', { message: err.message });
    }
  }
};
