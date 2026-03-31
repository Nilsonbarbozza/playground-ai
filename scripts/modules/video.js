import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * Video Module (Image-to-Video)
 */
export const videoModule = {
  previewObjectUrl: null,
  presetMap: {
    balanced: { cfg_scale: 1.8, motion_bucket_id: 127 },
    smooth: { cfg_scale: 2.0, motion_bucket_id: 90 },
    dynamic: { cfg_scale: 1.5, motion_bucket_id: 180 },
    cinematic: { cfg_scale: 2.2, motion_bucket_id: 110 }
  },

  init() {
    const btn = document.getElementById('btn-generate-video');
    const input = document.getElementById('video-prompt');
    const fileInput = document.getElementById('video-file-input');
    const uploader = document.getElementById('video-image-uploader');
    const promptUploaderBtn = document.getElementById('video-prompt-upload-btn');
    const uploadPrompt = document.getElementById('video-upload-prompt');
    const previewImg = document.getElementById('video-preview-img');
    const selectedImg = document.getElementById('video-selected-img');
    const player = document.getElementById('video-player');
    const loader = document.getElementById('video-loader');
    const placeholder = document.getElementById('video-placeholder');
    const errorDiv = document.getElementById('video-error');
    const removeInputBtn = document.getElementById('btn-remove-video-input');

    if (!btn) return;

    const openPicker = () => {
      if (!fileInput) return;
      fileInput.value = '';
      fileInput.click();
    };

    if (uploader && fileInput) {
      uploader.addEventListener('click', openPicker);
    }
    if (promptUploaderBtn && fileInput) {
      promptUploaderBtn.addEventListener('click', openPicker);
    }

    if (fileInput) {
      const onSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        this.showSelectedPreview(file, { previewImg, selectedImg, uploadPrompt, placeholder, player });
      };
      fileInput.addEventListener('change', onSelect);
      fileInput.addEventListener('input', onSelect);
    }

    if (removeInputBtn) {
      removeInputBtn.addEventListener('click', () => {
        if (this.previewObjectUrl) {
          URL.revokeObjectURL(this.previewObjectUrl);
          this.previewObjectUrl = null;
        }
        if (fileInput) fileInput.value = '';
        if (previewImg) {
          previewImg.src = '';
          previewImg.classList.add('tw-hidden');
        }
        if (selectedImg) {
          selectedImg.src = '';
          selectedImg.classList.add('tw-hidden');
        }
        uploadPrompt?.classList.remove('tw-hidden');
        placeholder?.classList.remove('tw-hidden');
        placeholder?.classList.remove('tw-opacity-100');
        placeholder?.classList.add('tw-opacity-60');
        player?.classList.add('tw-hidden');
      });
    }

    btn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      const file = fileInput.files[0];
      const presetValue = document.getElementById('video-preset')?.value || 'balanced';
      const profileValue = document.getElementById('video-profile')?.value || 'balanced';
      const seedValue = String(document.getElementById('video-seed')?.value || '').trim();
      const preset = this.presetMap[presetValue] || this.presetMap.balanced;

      if (!file) {
        return ui.showToast('Envie uma imagem para gerar o video.', 'warning');
      }

      try {
        ui.setLoading('btn-generate-video', true, 'Iniciando...');
        placeholder.classList.add('tw-hidden');
        selectedImg?.classList.add('tw-hidden');
        player.classList.add('tw-hidden');
        loader.classList.remove('tw-hidden');
        loader.classList.add('tw-flex');
        errorDiv.classList.add('tw-hidden');

        const formData = new FormData();
        formData.append('image', file);
        if (prompt) formData.append('prompt', prompt);
        formData.append('cfg_scale', String(preset.cfg_scale));
        formData.append('motion_bucket_id', String(preset.motion_bucket_id));
        formData.append('profile', profileValue);
        if (seedValue) formData.append('seed', seedValue);

        const data = await api.post('/video/generate', formData, true);
        this.pollStatus(data.job_id);
      } catch (err) {
        this.handleError(err.message);
      }
    });

    const downloadBtn = document.getElementById('btn-download-video');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        if (!player.src) return;
        const a = document.createElement('a');
        a.href = player.src;
        a.download = `ai-video-${Date.now()}.mp4`;
        a.click();
      };
    }
  },

  showSelectedPreview(file, elements = {}) {
    const { previewImg, selectedImg, uploadPrompt, placeholder, player } = elements;
    if (!previewImg) return;

    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }

    const applyVisibleState = (src) => {
      previewImg.src = src;
      previewImg.style.display = 'block';
      previewImg.classList.remove('tw-hidden');
      previewImg.classList.add('tw-z-10');
      uploadPrompt?.classList.add('tw-hidden');
      placeholder?.classList.remove('tw-opacity-60');
      placeholder?.classList.add('tw-opacity-100');
      placeholder?.classList.add('tw-hidden');
      if (selectedImg) {
        selectedImg.src = src;
        selectedImg.classList.remove('tw-hidden');
      }
      player?.classList.add('tw-hidden');
    };

    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result.length > 0) {
          applyVisibleState(reader.result);
          return;
        }
        const objectUrl = URL.createObjectURL(file);
        this.previewObjectUrl = objectUrl;
        applyVisibleState(objectUrl);
      };
      reader.onerror = () => {
        const objectUrl = URL.createObjectURL(file);
        this.previewObjectUrl = objectUrl;
        applyVisibleState(objectUrl);
      };
      reader.readAsDataURL(file);
    } catch {
      const objectUrl = URL.createObjectURL(file);
      this.previewObjectUrl = objectUrl;
      applyVisibleState(objectUrl);
    }
  },

  async pollStatus(jobId) {
    const loader = document.getElementById('video-loader');
    const player = document.getElementById('video-player');

    const interval = setInterval(async () => {
      try {
        const data = await api.post(`/video/status/${jobId}/sync`, {});

        if (data.status === 'finished') {
          clearInterval(interval);
          player.src = data.url;
          loader.classList.add('tw-hidden');
          player.classList.remove('tw-hidden');
          ui.setLoading('btn-generate-video', false);
          auth.refreshUser();
          return;
        }

        if (data.status === 'failed') {
          clearInterval(interval);
          this.handleError(data.error || 'Falha ao gerar video.');
        }
      } catch (err) {
        if (err.message.includes('Sessao expirada') || err.message.includes('Sessão expirada')) {
          clearInterval(interval);
          return;
        }
        console.warn('Polling...', err.message);
      }
    }, 10000);
  },

  handleError(msg) {
    const errorDiv = document.getElementById('video-error');
    const loader = document.getElementById('video-loader');
    const placeholder = document.getElementById('video-placeholder');
    const selectedImg = document.getElementById('video-selected-img');

    errorDiv.textContent = msg;
    errorDiv.classList.remove('tw-hidden');
    loader.classList.add('tw-hidden');
    if (!selectedImg?.src) {
      placeholder.classList.remove('tw-hidden');
    } else {
      selectedImg.classList.remove('tw-hidden');
    }
    ui.setLoading('btn-generate-video', false);
  }
};
