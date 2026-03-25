import { api } from '../services/api.js';
import { ui } from './ui.js';

/**
 * Image Engine Module
 * Handles Text-to-Image, Image Inpaint and Image Erase.
 */
export const imageEngine = {
  init() {
    this.initTextToImage();
    this.initImageEditor();
    console.log('[ImageEngine] Initialized');
  },

  initTextToImage() {
    const btn = document.getElementById('btn-generate-t2i');
    const input = document.getElementById('prompt-t2i');
    if (!btn || !input) return;

    btn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      if (!prompt) return ui.showToast('Digite um prompt.', 'warning');

      try {
        ui.setLoading('btn-generate-t2i', true, 'Gerando...');
        const data = await api.post('/generate', { prompt });
        
        // Show result
        const resultImg = document.getElementById('result-image-t2i');
        if (resultImg) {
          resultImg.src = data.url;
          resultImg.classList.remove('tw-hidden');
        }
        
        // Update credits if returned
        if (data.project && data.project.user_credits) {
          ui.updateCreditsDisplay(data.project.user_credits);
        }
      } catch (err) {
        ui.showToast(err.message, 'error');
      } finally {
        ui.setLoading('btn-generate-t2i', false);
      }
    });
  },

  initImageEditor() {
    const btn = document.getElementById('btn-generate-edit');
    const input = document.getElementById('prompt-edit');
    const uploadInput = document.getElementById('image-upload');
    const canvas = document.getElementById('editor-canvas');

    if (!btn || !input || !uploadInput) return;

    btn.addEventListener('click', async () => {
      const prompt = input.value.trim();
      if (!prompt) return ui.showToast('Descreva a edição.', 'warning');
      
      // Need image buffer from canvas/upload?
      // For now, let's assume we use the original file if no manual mask is drawn yet,
      // or we extract the canvas data.
      
      try {
        ui.setLoading('btn-generate-edit', true, 'Editando...');
        
        const formData = new FormData();
        formData.append('prompt', prompt);
        
        // Logic to get image and mask from editor goes here...
        // This is a placeholder for the actual extraction logic from main.js
        console.warn('Image Editor logic needs full porting of canvas/mask handling.');

        // const data = await api.post('/edit', formData, true);
        // ...
      } catch (err) {
        ui.showToast(err.message, 'error');
      } finally {
        ui.setLoading('btn-generate-edit', false);
      }
    });
  }
};
