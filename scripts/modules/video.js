import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * Video Module (Text-to-Video / Image-to-Video)
 */
export const videoModule = {
  init() {
    const btn = document.getElementById('btn-generate-video');
    const input = document.getElementById('video-prompt');
    const fileInput = document.getElementById('video-file-input');
    const previewImg = document.getElementById('video-preview-img');
    const player = document.getElementById('video-player');
    const loader = document.getElementById('video-loader');
    const placeholder = document.getElementById('video-placeholder');
    const errorDiv = document.getElementById('video-error');

    if (!btn) return;

    btn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      const file = fileInput.files[0];

      if (!prompt && !file) return ui.showToast('Insira um prompt ou imagem.', 'warning');

      try {
        ui.setLoading('btn-generate-video', true, 'Iniciando...');
        placeholder.classList.add('tw-hidden');
        player.classList.add('tw-hidden');
        loader.classList.remove('tw-hidden');
        loader.classList.add('tw-flex');
        errorDiv.classList.add('tw-hidden');

        const formData = new FormData();
        if (file) formData.append('image', file);
        if (prompt) formData.append('prompt', prompt);

        const data = await api.post('/video/generate', formData, true);
        this.pollStatus(data.generation_id);

      } catch (err) {
        this.handleError(err.message);
      }
    });

    const downloadBtn = document.getElementById('btn-download-video');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        if (player.src) {
          const a = document.createElement('a');
          a.href = player.src;
          a.download = `ai-video-${Date.now()}.mp4`;
          a.click();
        }
      };
    }
  },

  async pollStatus(genId) {
    const loader = document.getElementById('video-loader');
    const player = document.getElementById('video-player');

    const interval = setInterval(async () => {
      try {
        const data = await api.get(`/video/status/${genId}`);
        
        // If 202 status, api service might throw or return based on status codes.
        // My api.js throws on 401, but handles 202 as a normal JSON if the server returns it.
        // In the modular server, 202 returns { status: 'in-progress' }.
        
        if (data.status === 'finished') {
          clearInterval(interval);
          player.src = data.url;
          loader.classList.add('tw-hidden');
          player.classList.remove('tw-hidden');
          ui.setLoading('btn-generate-video', false);
          auth.init(); // Refresh credits
        }
      } catch (err) {
        if (err.message.includes('Sessão expirada')) return clearInterval(interval);
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
