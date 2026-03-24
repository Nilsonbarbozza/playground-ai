const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Wrap image editor in view-panel
html = html.replace(
  '<div\n                  class="grid min-h-full grid-rows-[1fr_auto]"\n                  data-testid="@ai-playground-v2/image-editor/container"\n                >',
  '<div id="view-image-editor" class="view-panel active pt-4 px-4" style="display:block">\n<div\n                  class="grid min-h-full grid-rows-[1fr_auto]"\n                  data-testid="@ai-playground-v2/image-editor/container"\n                >'
);

// Ensure closing div is injected properly before the end of content/main
const injectionSplit = '<section\n            aria-atomic="false"';

const viewsHTML = `
                </div> <!-- /#view-image-editor -->

                <!-- VIEW: Meus Projetos -->
                <div id="view-projects" class="view-panel hidden tw-p-8 tw-w-full tw-mx-auto tw-max-w-6xl">
                  <div class="tw-flex tw-items-center tw-justify-between tw-mb-8">
                    <h2 class="tw-text-3xl tw-font-bold tw-text-gray-800 tw-tracking-tight tw-flex tw-items-center tw-gap-3">
                        <span class="tw-bg-blue-100 tw-text-blue-600 tw-p-2 tw-rounded-xl">
                            <svg class="tw-w-6 tw-h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </span>
                        Meus Projetos
                    </h2>
                  </div>
                  <div id="projects-grid" class="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 lg:tw-grid-cols-5 tw-gap-4 tw-auto-rows-max">
                  </div>
                  <div id="projects-empty" class="tw-hidden tw-flex-col tw-items-center tw-justify-center tw-py-20">
                      <p class="tw-text-gray-500 tw-text-lg tw-font-medium">Nenhum projeto encontrado</p>
                  </div>
                </div>

                <!-- VIEW: AI Video Generator -->
                <div id="view-video" class="view-panel hidden tw-flex tw-flex-col tw-items-center tw-justify-center tw-h-full tw-w-full tw-p-8">
                    <div class="tw-w-full tw-max-w-2xl tw-bg-white tw-shadow-2xl tw-rounded-3xl tw-overflow-hidden tw-border tw-border-gray-100">
                        <div class="tw-bg-gradient-to-r tw-from-indigo-600 tw-to-purple-600 tw-px-8 tw-py-6 tw-text-white">
                            <div class="tw-flex tw-items-center tw-gap-4">
                                <div class="tw-bg-white/20 tw-p-3 tw-rounded-2xl tw-backdrop-blur-sm">
                                    <svg class="tw-w-8 tw-h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h2 class="tw-text-2xl tw-font-bold tw-tracking-tight">Video Generator AI</h2>
                                </div>
                            </div>
                        </div>
                        <div class="tw-p-8">
                            <div class="tw-mb-6">
                               <label class="tw-block tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-2">
                                   Imagem de Origem (Opcional)
                               </label>
                               <div id="video-image-uploader" class="tw-w-full tw-h-48 tw-border-2 tw-border-dashed tw-border-gray-200 tw-rounded-2xl tw-bg-gray-50 hover:tw-bg-gray-100 tw-transition-colors tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-relative">
                                   <input type="file" id="video-file-input" accept="image/*" class="tw-hidden" />
                                   <div id="video-upload-prompt" class="tw-text-center">
                                       <span class="tw-text-sm tw-text-gray-600">Clique para carregar uma imagem</span>
                                   </div>
                                   <img id="video-preview-img" class="tw-hidden tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-contain tw-rounded-xl" />
                               </div>
                            </div>
                            <div class="tw-space-y-4">
                                <div>
                                    <label for="video-prompt" class="tw-block tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-2">
                                        Prompt Criativo
                                    </label>
                                    <textarea id="video-prompt" rows="3" class="tw-w-full tw-px-4 tw-py-3 tw-bg-gray-50 tw-border tw-border-gray-200 tw-rounded-xl tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-indigo-500 focus:tw-bg-white tw-transition-all tw-resize-none" placeholder="Ex: Uma renderização 3D de um carro..."></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="tw-bg-gray-50 tw-px-8 tw-py-5 tw-border-t tw-border-gray-100 tw-flex tw-items-center tw-justify-between">
                            <div class="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-gray-500">
                                <span>Custo: <strong>10 créditos</strong></span>
                            </div>
                            <button id="btn-generate-video" class="tw-px-6 tw-py-2.5 tw-bg-indigo-600 tw-text-white tw-font-medium tw-rounded-xl hover:tw-bg-indigo-700 disabled:tw-opacity-50">
                                <span>Gerar Vídeo</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- VIEW: Face Swap -->
                <div id="view-faceswap" class="view-panel hidden tw-flex tw-flex-col tw-items-center tw-justify-center tw-h-full tw-w-full tw-p-8">
                     <div class="tw-w-full tw-max-w-3xl tw-bg-white tw-shadow-2xl tw-rounded-3xl tw-overflow-hidden tw-border tw-border-gray-100">
                        <div class="tw-bg-gradient-to-r tw-from-pink-500 tw-to-orange-400 tw-px-8 tw-py-6 tw-text-white">
                            <div class="tw-flex tw-items-center tw-gap-4">
                                <div class="tw-bg-white/20 tw-p-3 tw-rounded-2xl tw-backdrop-blur-sm">
                                    <span class="tw-text-2xl">🎭</span>
                                </div>
                                <div>
                                    <h2 class="tw-text-2xl tw-font-bold tw-tracking-tight">Troca de Rosto (FaceSwap)</h2>
                                </div>
                            </div>
                        </div>
                        <div class="tw-p-8">
                            <div class="tw-flex tw-flex-col sm:tw-flex-row tw-gap-8 tw-items-center sm:tw-items-start">
                                <div class="tw-w-full sm:tw-w-1/2 tw-space-y-2">
                                    <label class="tw-block tw-text-sm tw-font-semibold tw-text-gray-700 tw-text-center">Imagem Base (O Corpo)</label>
                                    <div id="faceswap-target-uploader" class="tw-h-64 tw-border-2 tw-border-dashed tw-border-gray-200 tw-rounded-2xl tw-bg-gray-50 hover:tw-bg-gray-100 tw-transition-colors tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-relative tw-overflow-hidden">
                                        <input type="file" id="faceswap-target-input" accept="image/*" class="tw-hidden" />
                                        <div id="faceswap-target-prompt" class="tw-text-center">
                                            <div class="tw-text-4xl tw-mb-2">🧍</div>
                                        </div>
                                        <img id="faceswap-target-preview" class="tw-hidden tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-contain tw-bg-gray-100" />
                                    </div>
                                </div>
                                <div class="tw-w-full sm:tw-w-1/2 tw-space-y-2">
                                    <label class="tw-block tw-text-sm tw-font-semibold tw-text-gray-700 tw-text-center">Imagem do Rosto (Origem)</label>
                                    <div id="faceswap-source-uploader" class="tw-h-64 tw-border-2 tw-border-dashed tw-border-gray-200 tw-rounded-2xl tw-bg-gray-50 hover:tw-bg-gray-100 tw-transition-colors tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-relative tw-overflow-hidden">
                                        <input type="file" id="faceswap-source-input" accept="image/*" class="tw-hidden" />
                                        <div id="faceswap-source-prompt" class="tw-text-center">
                                            <div class="tw-text-4xl tw-mb-2">👤</div>
                                        </div>
                                        <img id="faceswap-source-preview" class="tw-hidden tw-absolute tw-inset-0 tw-w-full tw-h-full tw-object-contain tw-bg-gray-100" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tw-bg-gray-50 tw-px-8 tw-py-5 tw-border-t tw-border-gray-100 tw-flex tw-items-center tw-justify-between">
                            <div class="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-gray-500">
                                <span>Custo: <strong>2 créditos</strong></span>
                            </div>
                            <button id="btn-generate-faceswap" class=\"tw-px-6 tw-py-2.5 tw-bg-gradient-to-r tw-from-pink-500 tw-to-orange-500 tw-text-white tw-font-medium tw-rounded-xl hover:tw-opacity-90 disabled:tw-opacity-50\">
                                <span>Fundir Rostos</span>
                            </button>
                        </div>
                     </div>
                </div>

          <section\n            aria-atomic="false"`;

if (html.includes(injectionSplit)) {
    html = html.replace(injectionSplit, viewsHTML);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('✅ REFACTOR SUCCESSFUL!');
