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
      sizePreset: document.getElementById('upscale-size-preset'),
      widthInput: document.getElementById('upscale-width'),
      heightInput: document.getElementById('upscale-height'),
      fit: document.getElementById('upscale-fit'),
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
    this.elements.sizePreset?.addEventListener('change', () => this.syncSizeControls());
    this.syncSizeControls();
  },

  syncSizeControls() {
    const preset = this.elements.sizePreset?.value || 'none';
    const isCustom = preset === 'custom';
    const usesFixedSize = preset !== 'none';

    this.elements.widthInput?.classList.toggle('tw-hidden', !isCustom);
    this.elements.heightInput?.classList.toggle('tw-hidden', !isCustom);

    if (this.elements.factor) {
      this.elements.factor.disabled = usesFixedSize;
      this.elements.factor.classList.toggle('tw-opacity-50', usesFixedSize);
      this.elements.factor.title = usesFixedSize
        ? 'Escala desativada ao usar tamanho fixo.'
        : '';
    }
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

  setProcessingState(loading) {
    if (loading) {
      this.elements.placeholder?.classList.add('tw-hidden');
      this.elements.previewContainer?.classList.add('tw-hidden');
      this.elements.loader?.classList.remove('tw-hidden');
      this.elements.loader?.classList.add('tw-flex');
      return;
    }
    this.elements.loader?.classList.add('tw-hidden');
    this.elements.loader?.classList.remove('tw-flex');
  },

  resolveResultUrl(data) {
    return (
      data?.url ||
      data?.imageUrl ||
      data?.project?.imageUrl ||
      ''
    );
  },

  async applyResultPreview(url) {
    if (!this.elements.previewImg || !url) return;
    const resolved = new URL(url, window.location.origin).toString();
    const cacheBusted = `${resolved}${resolved.includes('?') ? '&' : '?'}t=${Date.now()}`;

    await new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = resolve;
      probe.onerror = reject;
      probe.src = cacheBusted;
    });

    this.clearObjectUrl();
    this.currentFile = null;
    this.elements.previewImg.src = cacheBusted;
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
    const previousPreviewSrc = this.elements.previewImg?.src || '';
    if (this.elements.previewImg) this.elements.previewImg.src = '';
    this.setLoading(true);
    this.setProcessingState(true);

    try {
      const formData = new FormData();
      formData.append('image', inputFile);
      formData.append('intent', this.elements.intent?.value || 'both');
      formData.append('factor', this.elements.factor?.value || '2x');
      formData.append('quality_profile', this.elements.quality?.value || 'balanced');
      formData.append('output_format', this.elements.format?.value || 'png');
      formData.append('size_preset', this.elements.sizePreset?.value || 'none');
      formData.append('fit', this.elements.fit?.value || 'cover');

      const width = String(this.elements.widthInput?.value || '').trim();
      const height = String(this.elements.heightInput?.value || '').trim();
      const isCustom = (this.elements.sizePreset?.value || '') === 'custom';
      if (isCustom) {
        if (!width || !height) {
          throw new Error('Informe largura e altura para tamanho personalizado.');
        }
        formData.append('width', width);
        formData.append('height', height);
      }

      const data = await api.post('/upscale', formData, true);
      const resultUrl = this.resolveResultUrl(data);
      if (!resultUrl) throw new Error('Upscale concluido, mas a URL do resultado nao foi retornada.');
      try {
        await this.applyResultPreview(resultUrl);
      } catch {
        if (this.elements.previewImg) this.elements.previewImg.src = resultUrl;
      }
      this.setView(true);
      auth.refreshUser();
      ui.showToast('Upscale concluido com sucesso.');
    } catch (err) {
      if (previousPreviewSrc && this.elements.previewImg) {
        this.elements.previewImg.src = previousPreviewSrc;
        this.setView(true);
      } else {
        this.setView(false);
      }
      this.showError(err.message || 'Falha no upscale.');
    } finally {
      this.setLoading(false);
      this.setProcessingState(false);
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
