import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

export const upscale = {
  elements: {},
  currentFile: null,
  previewObjectUrl: null,

  init() {
    this.mapElements();
    if (!this.elements.generateBtn || !this.elements.fileInput) return;
    this.bindEvents();
  },

  mapElements() {
    this.elements = {
      placeholder: document.getElementById('upscale-placeholder'),
      uploader: document.getElementById('upscale-uploader-container'),
      previewContainer: document.getElementById('upscale-preview-container'),
      previewImg: document.getElementById('upscale-preview-img'),
      removeBtn: document.getElementById('remove-upscale-img'),
      fileInput: document.getElementById('upscale-file-input'),
      generateBtn: document.getElementById('btn-generate-upscale'),
      spinner: document.getElementById('upscale-spinner'),
      loader: document.getElementById('upscale-loader'),
      error: document.getElementById('upscale-error'),
      downloadBtn: document.getElementById('btn-download-upscale'),
      promptInput: document.getElementById('upscale-prompt'),
      intent: document.getElementById('upscale-intent'),
      factor: document.getElementById('upscale-factor'),
      quality: document.getElementById('upscale-quality'),
      format: document.getElementById('upscale-format')
    };
  },

  bindEvents() {
    this.elements.uploader?.addEventListener('click', () => this.elements.fileInput?.click());
    this.elements.fileInput?.addEventListener('change', (e) => this.onFileChange(e));
    this.elements.removeBtn?.addEventListener('click', () => this.reset());
    this.elements.generateBtn?.addEventListener('click', () => this.handleGenerate());
    this.elements.downloadBtn?.addEventListener('click', () => this.downloadResult());
  },

  setView(isPreview) {
    this.elements.placeholder?.classList.toggle('tw-hidden', isPreview);
    this.elements.previewContainer?.classList.toggle('tw-hidden', !isPreview);
  },

  clearObjectUrl() {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  },

  onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.currentFile = file;
    this.clearObjectUrl();
    this.previewObjectUrl = URL.createObjectURL(file);
    if (this.elements.previewImg) this.elements.previewImg.src = this.previewObjectUrl;
    this.hideError();
    this.setView(true);
  },

  showError(message) {
    if (!this.elements.error) return;
    this.elements.error.textContent = message;
    this.elements.error.classList.remove('tw-hidden');
  },

  hideError() {
    this.elements.error?.classList.add('tw-hidden');
  },

  setLoading(loading) {
    if (!this.elements.generateBtn || !this.elements.spinner) return;
    this.elements.generateBtn.disabled = loading;
    this.elements.spinner.classList.toggle('tw-hidden', !loading);
  },

  async resolveInputFile() {
    if (this.currentFile) return this.currentFile;
    const src = this.elements.previewImg?.src || '';
    if (!src) return null;
    const response = await fetch(src);
    const blob = await response.blob();
    return new File([blob], 'upscale-input.png', { type: blob.type || 'image/png' });
  },

  async handleGenerate() {
    const inputFile = await this.resolveInputFile();
    if (!inputFile) return ui.showToast('Envie uma imagem para iniciar o upscale.', 'warning');

    this.hideError();
    this.setLoading(true);
    this.elements.loader?.classList.remove('tw-hidden');
    this.elements.loader?.classList.add('tw-flex');

    try {
      const formData = new FormData();
      formData.append('image', inputFile);
      formData.append('prompt', String(this.elements.promptInput?.value || '').trim());
      formData.append('intent', this.elements.intent?.value || 'both');
      formData.append('factor', this.elements.factor?.value || '2x');
      formData.append('quality_profile', this.elements.quality?.value || 'balanced');
      formData.append('output_format', this.elements.format?.value || 'png');

      const data = await api.post('/upscale', formData, true);
      if (this.elements.previewImg && data?.url) this.elements.previewImg.src = data.url;
      this.setView(true);
      auth.refreshUser();
      ui.showToast('Upscale concluido com sucesso.');
    } catch (err) {
      this.showError(err.message || 'Falha no upscale.');
    } finally {
      this.setLoading(false);
      this.elements.loader?.classList.add('tw-hidden');
      this.elements.loader?.classList.remove('tw-flex');
    }
  },

  downloadResult() {
    const src = this.elements.previewImg?.src || '';
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `upscale-${Date.now()}.png`;
    a.click();
  },

  reset() {
    this.currentFile = null;
    this.clearObjectUrl();
    if (this.elements.fileInput) this.elements.fileInput.value = '';
    if (this.elements.previewImg) this.elements.previewImg.src = '';
    this.hideError();
    this.setView(false);
  }
};

