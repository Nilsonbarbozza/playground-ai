import { api } from '../services/api.js';

/**
 * Projects Module (Gallery)
 */
export const projects = {
  init() {
    // Expose download globally for inline onclick
    window.downloadProjectImage = (url) => {
      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          // Extract filename from url or use default with original extension
          const ext = url.split('.').pop().split('?')[0] || 'png';
          link.download = `playground_export_${Date.now()}.${ext}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(blobUrl);
        })
        .catch(err => console.error('Erro no download:', err));
    };
    console.log('[Projects] Ready');
  },

  async loadGallery() {
    const grid = document.getElementById('projects-grid');
    const emptyState = document.getElementById('projects-empty');
    if (!grid) return;

    grid.innerHTML = '<div class="tw-col-span-full tw-text-center tw-text-gray-500 tw-py-20">Carregando seus projetos incríveis...</div>';
    emptyState.classList.add('tw-hidden');

    try {
      const data = await api.get('/user/projects');
      
      if (data.success && data.projects && data.projects.length > 0) {
        grid.innerHTML = data.projects.map(p => `
          <div class="tw-bg-white tw-border tw-border-gray-100 tw-rounded-2xl tw-overflow-hidden tw-shadow-sm hover:tw-shadow-xl tw-transition-all tw-group">
            <div class="tw-relative tw-aspect-square tw-overflow-hidden">
              <img src="${p.image_url}" alt="Projeto" class="tw-w-full tw-h-full tw-object-cover group-hover:tw-scale-110 tw-transition-transform tw-duration-500" />
              <div class="tw-absolute tw-inset-0 tw-bg-black/40 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity tw-flex tw-items-center tw-justify-center tw-gap-3">
                <button title="Visualizar" class="tw-bg-white tw-text-gray-700 hover:tw-text-blue-600 tw-p-2 tw-rounded-full tw-shadow-lg tw-transition-all hover:tw-scale-110" onclick="window.open('${p.image_url}', '_blank')">
                  <svg class="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </button>
                <button title="Baixar" class="tw-bg-white tw-text-gray-700 hover:tw-text-blue-600 tw-p-2 tw-rounded-full tw-shadow-lg tw-transition-all hover:tw-scale-110" onclick="event.stopPropagation(); window.downloadProjectImage('${p.image_url}')">
                  <svg class="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
              </div>
            </div>
            <div class="tw-p-4">
              <p class="tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-widest tw-text-gray-400 tw-mb-1">${new Date(p.created_at).toLocaleDateString()}</p>
              <p class="tw-text-sm tw-font-semibold tw-text-gray-800 tw-truncate" title="${p.prompt}">${p.prompt || 'Edição Sem Prompt'}</p>
            </div>
          </div>
        `).join('');
      } else {
        grid.innerHTML = '';
        emptyState.classList.remove('tw-hidden');
        emptyState.classList.add('tw-flex');
      }
    } catch (err) {
      grid.innerHTML = `<div class="tw-col-span-full tw-text-center tw-text-red-500 tw-py-20">${err.message}</div>`;
    }
  }
};
