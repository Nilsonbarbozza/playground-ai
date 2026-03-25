import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * Text-to-Image Module
 */
export const text2img = {
  init() {
    const btn = document.getElementById('btn-generate-t2i');
    const input = document.getElementById('t2i-prompt');
    const previewImg = document.getElementById('t2i-preview-img');
    const loader = document.getElementById('t2i-loader');
    const placeholder = document.getElementById('t2i-placeholder');
    const errorDiv = document.getElementById('t2i-error');

    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      if (!prompt) return ui.showToast('Digite um prompt.', 'warning');

      try {
        // UI State: Processing
        btn.disabled = true;
        placeholder.classList.add('tw-hidden');
        previewImg.classList.add('tw-hidden');
        loader.classList.remove('tw-hidden');
        loader.classList.add('tw-flex');
        errorDiv.classList.add('tw-hidden');

        const data = await api.post('/generate', { prompt });
        
        // Show result
        previewImg.src = data.url;
        loader.classList.add('tw-hidden');
        previewImg.classList.remove('tw-hidden');

        // Refresh user credits in UI
        auth.refreshUser();
      } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('tw-hidden');
        loader.classList.add('tw-hidden');
        placeholder.classList.remove('tw-hidden');
      } finally {
        btn.disabled = false;
      }
    });

    // Download Handler
    const downloadBtn = document.getElementById('btn-download-t2i');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const src = previewImg.src;
        if (src && !src.includes('placeholder')) {
          const a = document.createElement('a');
          a.href = src;
          a.download = `ai-image-${Date.now()}.png`;
          a.click();
        }
      };
    }
  }
};
