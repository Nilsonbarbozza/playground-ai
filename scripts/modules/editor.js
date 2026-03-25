import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * Image Editor Module (Level 3)
 * Ported from main.js with modular improvements.
 */
export const editor = {
  elements: {},
  canvasObj: { ctx: null, isDrawing: false, lastX: 0, lastY: 0 },
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
        el.placeholder.classList.remove('tw-hidden');
        el.fileInput.value = '';
        this.clearCanvas();
        break;
      case 'PREVIEW':
        el.previewContainer.classList.remove('tw-hidden');
        el.controls.classList.remove('tw-hidden');
        if (data.src) {
          el.previewImg.src = data.src;
          this.originalImage.src = data.src;
          el.maskCanvas.width = 1024;
          el.maskCanvas.height = 1024;
          this.clearCanvas();
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

  initCanvas() {
    const cvs = this.elements.maskCanvas;
    if (!cvs) return;

    const getMousePos = (e) => {
      const rect = cvs.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (1024 / rect.width),
        y: (clientY - rect.top) * (1024 / rect.height)
      };
    };

    const startDrawing = (e) => {
      if (this.currentState !== 'PREVIEW') return;
      e.preventDefault();
      this.canvasObj.isDrawing = true;
      const { x, y } = getMousePos(e);
      this.canvasObj.lastX = x;
      this.canvasObj.lastY = y;
    };

    const draw = (e) => {
      if (!this.canvasObj.isDrawing || this.currentState !== 'PREVIEW') return;
      e.preventDefault();
      const { x, y } = getMousePos(e);
      const ctx = this.canvasObj.ctx;
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
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

    cvs.addEventListener('mousedown', startDrawing);
    cvs.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', () => this.canvasObj.isDrawing = false);
    
    // Touch support
    cvs.addEventListener('touchstart', startDrawing);
    cvs.addEventListener('touchmove', draw);
    cvs.addEventListener('touchend', () => this.canvasObj.isDrawing = false);

    this.elements.clearMask.onclick = () => this.clearCanvas();
  },

  clearCanvas() {
    if (this.canvasObj.ctx) {
      this.canvasObj.ctx.clearRect(0, 0, this.elements.maskCanvas.width, this.elements.maskCanvas.height);
    }
  },

  initListeners() {
    const el = this.elements;
    
    el.uploader.onclick = () => { if(this.currentState === 'IDLE') el.fileInput.click(); };
    el.removeBtn.onclick = (e) => { e.stopPropagation(); this.setState('IDLE'); };
    
    el.fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => this.setState('PREVIEW', { src: ev.target.result });
        reader.readAsDataURL(file);
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
    if (!promptValue) return ui.showToast('Digite um prompt para a edição.', 'warning');

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
