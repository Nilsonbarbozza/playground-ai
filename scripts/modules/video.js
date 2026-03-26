import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * Video Module (Image-to-Video)
 */
export const videoModule = {
  init() {
    const btn = document.getElementById('btn-generate-video');
    const input = document.getElementById('video-prompt');
    const fileInput = document.getElementById('video-file-input');
    const player = document.getElementById('video-player');
    const loader = document.getElementById('video-loader');
    const placeholder = document.getElementById('video-placeholder');
    const errorDiv = document.getElementById('video-error');

    if (!btn) return;

    btn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      const file = fileInput.files[0];

      if (!file) {
        return ui.showToast('Envie uma imagem para gerar o video.', 'warning');
      }

      try {
        ui.setLoading('btn-generate-video', true, 'Iniciando...');
        placeholder.classList.add('tw-hidden');
        player.classList.add('tw-hidden');
        loader.classList.remove('tw-hidden');
        loader.classList.add('tw-flex');
        errorDiv.classList.add('tw-hidden');

        const formData = new FormData();
        formData.append('image', file);
        if (prompt) formData.append('prompt', prompt);

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

    errorDiv.textContent = msg;
    errorDiv.classList.remove('tw-hidden');
    loader.classList.add('tw-hidden');
    placeholder.classList.remove('tw-hidden');
    ui.setLoading('btn-generate-video', false);
  }
};
