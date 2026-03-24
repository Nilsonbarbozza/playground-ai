const fs = require('fs');

let js = fs.readFileSync('scripts/main.js', 'utf8');

// 1. Update DOMContentLoaded
js = js.replace(
  `document.addEventListener('DOMContentLoaded', () => {\n    initImageHandlers();\n    initSidebarToggle();\n    initImageEditor();\n    initAuthData();\n    initProjectsModal();\n    initGenerateModal();\n    initVideoModal();\n    initFaceSwapModal();\n});`,
  `document.addEventListener('DOMContentLoaded', () => {\n    initNavigation();\n    initImageHandlers();\n    initSidebarToggle();\n    initImageEditor();\n    initAuthData();\n\n    initVideoGenerator();\n    initFaceSwapGenerator();\n});`
);

// 2. Replace initProjectsModal and initGenerateModal with Navigation Logic + Projects Fetch
const navLogic = `
/**
 * SAAS: SPA Navigation Controller
 */
function initNavigation() {
  const views = {
    projects: document.getElementById('view-projects'),
    imageEditor: document.getElementById('view-image-editor'),
    video: document.getElementById('view-video'),
    faceswap: document.getElementById('view-faceswap')
  };

  const buttons = {
    projects: document.querySelector('[data-testid="@ai-playground-v2/sidebar-my-creations"]'),
    textToImage: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/text-to-image"]'),
    imageToImage: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/image-to-image"]'),
    textToVideo: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/text-to-video"]'),
    imageToVideo: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/image-to-video"]'),
    faceswap: document.querySelector('[data-testid="@ai-playground-v2/sidebar-category/video-to-video"]')
  };

  function switchView(viewName) {
    // Hide all views
    Object.values(views).forEach(view => {
      if (view) {
        view.classList.add('hidden', 'tw-hidden');
        view.classList.remove('active', 'block', 'tw-flex');
        view.style.display = 'none';
      }
    });
    
    // Deactivate all buttons
    Object.values(buttons).forEach(btn => {
      if (btn) btn.setAttribute('data-active', 'false');
    });

    // Show target view
    const targetView = views[viewName];
    if (targetView) {
      if (viewName === 'imageEditor' || viewName === 'projects') {
        targetView.classList.remove('hidden', 'tw-hidden');
        targetView.style.display = 'block';
      } else {
        targetView.classList.remove('hidden', 'tw-hidden');
        targetView.classList.add('tw-flex');
        targetView.style.display = '';
      }
    }

    // Execute specific view logic
    if (viewName === 'projects') {
      loadProjectsView();
    }
  }

  // Event Listeners
  if (buttons.projects) {
    buttons.projects.addEventListener('click', () => {
      switchView('projects');
      buttons.projects.setAttribute('data-active', 'true');
    });
  }

  if (buttons.textToImage) {
    buttons.textToImage.addEventListener('click', () => {
      switchView('imageEditor');
      buttons.textToImage.setAttribute('data-active', 'true');
    });
  }
  
  if (buttons.imageToImage) {
    buttons.imageToImage.addEventListener('click', () => {
      switchView('imageEditor');
      buttons.imageToImage.setAttribute('data-active', 'true');
    });
  }

  if (buttons.textToVideo) {
    buttons.textToVideo.addEventListener('click', () => {
      switchView('video');
      buttons.textToVideo.setAttribute('data-active', 'true');
    });
  }

  if (buttons.imageToVideo) {
    buttons.imageToVideo.addEventListener('click', () => {
      switchView('video');
      buttons.imageToVideo.setAttribute('data-active', 'true');
    });
  }

  if (buttons.faceswap) {
    buttons.faceswap.addEventListener('click', () => {
      switchView('faceswap');
      buttons.faceswap.setAttribute('data-active', 'true');
    });
  }
}

async function loadProjectsView() {
  const grid = document.getElementById('projects-grid');
  const emptyState = document.getElementById('projects-empty');
  if (!grid || !emptyState) return;

  grid.innerHTML = '<div class="tw-col-span-full tw-text-center tw-text-gray-500">Carregando projetos...</div>';
  emptyState.classList.add('tw-hidden');

  const token = localStorage.getItem('token');
  if (!token) {
    grid.innerHTML = '';
    emptyState.classList.remove('tw-hidden');
    return;
  }

  try {
    const res = await fetch('/api/user/projects', {
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    const data = await res.json();

    if (data.success && data.projects && data.projects.length > 0) {
      grid.innerHTML = data.projects.map(p => \`
        <div class="tw-bg-white tw-border tw-border-gray-100 tw-rounded-xl tw-overflow-hidden tw-shadow-sm hover:tw-shadow-md tw-transition-all">
          <img src="\${p.image_url}" alt="Projeto" class="tw-w-full tw-h-48 tw-object-cover" />
          <div class="tw-p-4">
            <p class="tw-text-xs tw-text-gray-400 tw-mb-1">\${new Date(p.created_at).toLocaleDateString()}</p>
            <p class="tw-text-sm tw-font-medium tw-text-gray-700 tw-truncate" title="\${p.prompt}">\${p.prompt || 'Edição Sem Prompt'}</p>
            \${p.type === 'video' ? '<span class="tw-inline-block tw-mt-2 tw-bg-indigo-100 tw-text-indigo-800 tw-text-xs tw-px-2 tw-py-1 tw-rounded-full">Vídeo</span>' : ''}
            \${p.type === 'faceswap' ? '<span class="tw-inline-block tw-mt-2 tw-bg-pink-100 tw-text-pink-800 tw-text-xs tw-px-2 tw-py-1 tw-rounded-full">FaceSwap</span>' : ''}
          </div>
        </div>
      \`).join('');
    } else {
      grid.innerHTML = '';
      emptyState.classList.remove('tw-hidden');
      emptyState.classList.add('tw-flex');
    }
  } catch (err) {
    grid.innerHTML = '<div class="tw-col-span-full tw-text-center tw-text-red-500">Erro ao carregar a galeria.</div>';
  }
}

/**
 * SAAS: Video Generator
 */
function initVideoGenerator() {
  const btnGenerate = document.getElementById('btn-generate-video');
  const txtPrompt = document.getElementById('video-prompt');
  const fileInput = document.getElementById('video-file-input');
  const uploaderArea = document.getElementById('video-image-uploader');
  const previewImg = document.getElementById('video-preview-img');
  const promptArea = document.getElementById('video-upload-prompt');
  
  let selectedFile = null;

  if (!btnGenerate) return;

  uploaderArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        const url = URL.createObjectURL(selectedFile);
        previewImg.src = url;
        previewImg.classList.remove('tw-hidden');
        promptArea.classList.add('tw-hidden');
    }
  });

  btnGenerate.addEventListener('click', async () => {
      const prompt = txtPrompt.value.trim();
      const token = localStorage.getItem('token') || '';
      
      if (!prompt && !selectedFile) {
          alert('Por favor, envie uma imagem ou digite um prompt.');
          return;
      }

      btnGenerate.disabled = true;
      btnGenerate.innerHTML = '<span>Gerando (Pode levar alguns minutos)...</span>';

      const formData = new FormData();
      if (prompt) formData.append('prompt', prompt);
      if (selectedFile) formData.append('image', selectedFile);

      try {
        const res = await fetch('/api/video/generate', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${token}\`
          },
          body: formData
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            alert('Vídeo gerado/enviado para processamento! Verifique seus projetos em alguns minutos.');
            initAuthData(); // Atualiza saldo
            txtPrompt.value = '';
            selectedFile = null;
            previewImg.classList.add('tw-hidden');
            promptArea.classList.remove('tw-hidden');
        } else {
          throw new Error(data.error || 'Erro na API de Vídeo');
        }
      } catch (err) {
          alert(err.message);
      } finally {
          btnGenerate.disabled = false;
          btnGenerate.innerHTML = '<span>Gerar Vídeo</span>';
      }
  });
}

/**
 * SAAS: FaceSwap Generator
 */
function initFaceSwapGenerator() {
   const btnGenerate = document.getElementById('btn-generate-faceswap');
   const inputTarget = document.getElementById('faceswap-target-input');
   const inputSource = document.getElementById('faceswap-source-input');
   const previewTarget = document.getElementById('faceswap-target-preview');
   const previewSource = document.getElementById('faceswap-source-preview');
   const promptTarget = document.getElementById('faceswap-target-prompt');
   const promptSource = document.getElementById('faceswap-source-prompt');

   let targetFile = null;
   let sourceFile = null;

   if (!btnGenerate) return;

   document.getElementById('faceswap-target-uploader').addEventListener('click', () => inputTarget.click());
   document.getElementById('faceswap-source-uploader').addEventListener('click', () => inputSource.click());

   inputTarget.addEventListener('change', (e) => {
       if (e.target.files && e.target.files.length > 0) {
           targetFile = e.target.files[0];
           previewTarget.src = URL.createObjectURL(targetFile);
           previewTarget.classList.remove('tw-hidden');
           promptTarget.classList.add('tw-hidden');
       }
   });

   inputSource.addEventListener('change', (e) => {
       if (e.target.files && e.target.files.length > 0) {
           sourceFile = e.target.files[0];
           previewSource.src = URL.createObjectURL(sourceFile);
           previewSource.classList.remove('tw-hidden');
           promptSource.classList.add('tw-hidden');
       }
   });

   btnGenerate.addEventListener('click', async () => {
       if (!targetFile || !sourceFile) {
           alert('Você precisa enviar ambas as imagens: o corpo e o rosto.');
           return;
       }

       const token = localStorage.getItem('token') || '';
       btnGenerate.disabled = true;
       btnGenerate.innerHTML = '<span>Processando...</span>';

       const formData = new FormData();
       formData.append('target_image', targetFile);
       formData.append('swap_image', sourceFile);

       try {
         const res = await fetch('/api/faceswap/generate', {
           method: 'POST',
           headers: {
             'Authorization': \`Bearer \${token}\`
           },
           body: formData
         });
         
         const data = await res.json();
         
         if (res.ok && data.success) {
             alert('FaceSwap Concluído com Sucesso! O resultado foi salvo em seus Projetos.');
             initAuthData(); // Atualiza saldo
             
             // Reset
             targetFile = null;
             sourceFile = null;
             previewTarget.classList.add('tw-hidden');
             previewSource.classList.add('tw-hidden');
             promptTarget.classList.remove('tw-hidden');
             promptSource.remove('tw-hidden');
         } else {
           throw new Error(data.error || 'Erro na API de FaceSwap');
         }
       } catch (err) {
           alert(err.message);
       } finally {
           btnGenerate.disabled = false;
           btnGenerate.innerHTML = '<span>Fundir Rostos</span>';
       }
   });
}
`;

// Remove old initProjectsModal to the end of initFaceSwapModal
const startIdx = js.indexOf('function initGenerateModal()');
const endIdx = js.indexOf('async function initAuthData()');

if (startIdx !== -1 && endIdx !== -1) {
    const p1 = js.substring(0, startIdx);
    const p2 = js.substring(endIdx);
    js = p1 + navLogic + '\n' + p2;
    fs.writeFileSync('scripts/main.js', js, 'utf8');
    console.log('✅ REFACTOR MAIN.JS SUCCESSFUL!');
} else {
    console.log('❌ Could not find blocks to replace');
}
