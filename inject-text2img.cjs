const fs = require('fs');

// 1. INJECT HTML
let html = fs.readFileSync('index.html', 'utf8');
const text2imgHTML = `
                <!-- VIEW: Texto para Imagem -->
                <div id="view-text2img" class="view-panel hidden tw-flex tw-flex-col tw-items-center tw-justify-center tw-h-full tw-w-full tw-p-8">
                    <div class="tw-w-full tw-max-w-2xl tw-bg-white tw-shadow-2xl tw-rounded-3xl tw-overflow-hidden tw-border tw-border-gray-100">
                        <div class="tw-bg-gradient-to-r tw-from-blue-600 tw-to-cyan-600 tw-px-8 tw-py-6 tw-text-white">
                            <div class="tw-flex tw-items-center tw-gap-4">
                                <div class="tw-bg-white/20 tw-p-3 tw-rounded-2xl tw-backdrop-blur-sm">
                                    <span class="tw-text-2xl">🖼️</span>
                                </div>
                                <div>
                                    <h2 class="tw-text-2xl tw-font-bold tw-tracking-tight">Gerador de Imagens AI</h2>
                                    <p class="tw-text-blue-100 tw-text-sm tw-mt-1">Crie imagens incríveis do zero a partir de descrições em texto.</p>
                                </div>
                            </div>
                        </div>
                        <div class="tw-p-8">
                            <div class="tw-mb-6 tw-flex tw-justify-center">
                                <div id="t2i-preview-container" class="tw-w-full tw-max-w-md tw-aspect-square tw-border-2 tw-border-dashed tw-border-gray-200 tw-rounded-2xl tw-bg-gray-50 tw-flex tw-items-center tw-justify-center tw-overflow-hidden tw-relative">
                                   <div id="t2i-placeholder" class="tw-text-center tw-text-gray-400">
                                        <span class="tw-text-4xl tw-block tw-mb-2">✨</span>
                                        <span class="tw-text-sm">Sua imagem aparecerá aqui</span>
                                   </div>
                                   <img id="t2i-preview-img" class="tw-hidden tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-contain tw-bg-white" />
                                </div>
                            </div>
                            <div class="tw-space-y-4">
                                <div>
                                    <label class="tw-block tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-2">
                                        Prompt (Descreva a imagem)
                                    </label>
                                    <textarea id="t2i-prompt" rows="3" class="tw-w-full tw-px-4 tw-py-3 tw-bg-gray-50 tw-border tw-border-gray-200 tw-rounded-xl tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-bg-white tw-transition-all tw-resize-none" placeholder="Ex: Um astronauta andando a cavalo na lua, estilo fotorrealista..."></textarea>
                                </div>
                            </div>
                            <div id="t2i-error" class="tw-hidden tw-mt-4 tw-p-3 tw-bg-red-50 tw-text-red-600 tw-text-sm tw-rounded-lg"></div>
                        </div>
                        <div class="tw-bg-gray-50 tw-px-8 tw-py-5 tw-border-t tw-border-gray-100 tw-flex tw-items-center tw-justify-between">
                            <div class="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-gray-500">
                                <span>Custo: <strong>1 crédito</strong></span>
                            </div>
                            <button id="btn-generate-t2i" class="tw-px-6 tw-py-2.5 tw-bg-blue-600 tw-text-white tw-font-medium tw-rounded-xl hover:tw-bg-blue-700 disabled:tw-opacity-50">
                                <span>Gerar Imagem</span>
                            </button>
                        </div>
                    </div>
                </div>
`;

if (!html.includes('id="view-text2img"')) {
    html = html.replace('<!-- VIEW: AI Video Generator -->', text2imgHTML + '\n                <!-- VIEW: AI Video Generator -->');
    fs.writeFileSync('index.html', html, 'utf8');
    console.log('HTML Injetado com Sucesso!');
}

// 2. INJECT JS
let js = fs.readFileSync('scripts/main.js', 'utf8');

// Add to views mapping
if (!js.includes('textToImage: document.getElementById(\'view-text2img\')')) {
    js = js.replace(
        /const views = \{([\s\S]*?)projects: document.getElementById\('view-projects'\),/,
        'const views = {$1textToImage: document.getElementById(\'view-text2img\'),\n    projects: document.getElementById(\'view-projects\'),'
    );
}

// Update Event Listener for textToImage
js = js.replace(
    /buttons\.textToImage\.addEventListener\('click', \(\) => switchView\('imageEditor', 'textToImage'\)\);/g,
    'buttons.textToImage.addEventListener(\'click\', () => switchView(\'textToImage\', \'textToImage\'));'
);

// Add JS initializer
const t2iLogic = `
/**
 * SAAS: Text-To-Image Generator
 */
function initText2ImgGenerator() {
   const btnGenerate = document.getElementById('btn-generate-t2i');
   const txtPrompt = document.getElementById('t2i-prompt');
   const previewImg = document.getElementById('t2i-preview-img');
   const placeholder = document.getElementById('t2i-placeholder');
   const errorDiv = document.getElementById('t2i-error');

   if (!btnGenerate) return;

   btnGenerate.addEventListener('click', async () => {
       const prompt = txtPrompt.value.trim();
       if (!prompt) return;

       const token = localStorage.getItem('token') || '';
       
       btnGenerate.disabled = true;
       btnGenerate.innerHTML = '<span>Gerando...</span>';
       errorDiv.classList.add('tw-hidden');

       const formData = new FormData();
       formData.append('prompt', prompt);

       try {
         const res = await fetch('/api/generate', {
           method: 'POST',
           headers: {
             'Authorization': \`Bearer \${token}\`
           },
           body: formData
         });
         
         const data = await res.json();
         
         if (res.ok && data.success) {
             previewImg.src = data.url;
             previewImg.classList.remove('tw-hidden');
             placeholder.classList.add('tw-hidden');
             initAuthData();
         } else {
           throw new Error(data.error || 'Erro na API');
         }
       } catch (err) {
           errorDiv.innerText = err.message;
           errorDiv.classList.remove('tw-hidden');
       } finally {
           btnGenerate.disabled = false;
           btnGenerate.innerHTML = '<span>Gerar Imagem</span>';
       }
   });
}
`;

if (!js.includes('function initText2ImgGenerator()')) {
    js += '\n' + t2iLogic;
}

// Add to DOMContentLoaded
if (!js.includes('initText2ImgGenerator();')) {
    js = js.replace(
        'initFaceSwapGenerator();',
        'initFaceSwapGenerator();\n    initText2ImgGenerator();'
    );
}

fs.writeFileSync('scripts/main.js', js, 'utf8');
console.log('JS Injetado com Sucesso!');
