import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * FaceSwap Module
 */
export const faceswap = {
  init() {
    const btn = document.getElementById('btn-generate-faceswap');
    const targetInput = document.getElementById('faceswap-target-input');
    const sourceInput = document.getElementById('faceswap-source-input');
    const placeholder = document.getElementById('faceswap-placeholder');
    const resultImg = document.getElementById('faceswap-result');
    const loader = document.getElementById('faceswap-loader');

    if (!btn) return;

    btn.addEventListener('click', async () => {
      const fTarget = targetInput.files[0];
      const fSource = sourceInput.files[0];

      if (!fTarget || !fSource) return ui.showToast('Selecione ambas as imagens.', 'warning');

      try {
        ui.setLoading('btn-generate-faceswap', true, 'Trocando Rosto...');
        placeholder.classList.add('tw-hidden');
        resultImg.classList.add('tw-hidden');
        loader.classList.remove('tw-hidden');
        loader.classList.add('tw-flex');

        const formData = new FormData();
        formData.append('target_image', fTarget);
        formData.append('swap_image', fSource);

        const data = await api.post('/faceswap/generate', formData, true);
        
        resultImg.src = data.url;
        loader.classList.add('tw-hidden');
        resultImg.classList.remove('tw-hidden');
        auth.init(); 

      } catch (err) {
        ui.showToast(err.message, 'error');
        loader.classList.add('tw-hidden');
        placeholder.classList.remove('tw-hidden');
      } finally {
        ui.setLoading('btn-generate-faceswap', false);
      }
    });

    // Download
    const downloadBtn = document.getElementById('btn-download-faceswap');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        if (resultImg.src && !resultImg.src.includes('placeholder')) {
          const a = document.createElement('a');
          a.href = resultImg.src;
          a.download = `faceswap-${Date.now()}.png`;
          a.click();
        }
      };
    }
  }
};
