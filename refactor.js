import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

// 1. Extrair os modais
const extractBlock = (startMarker, endMarker) => {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return '';
  
  // Find the closing </div> of the modal by counting divs or just finding the exact end marker
  // Using an exact string approach based on known structure
  const endIdx = html.indexOf(endMarker, startIdx) + endMarker.length;
  const block = html.substring(startIdx, endIdx);
  
  // Remove from original HTML
  html = html.substring(0, startIdx) + html.substring(endIdx);
  return block;
};

const strProj = extractBlock('<!-- Modal: Meus Projetos -->', '</div>\n    </div>\n\n    <!-- Modal: AI Generator -->');
const strGen = extractBlock('<!-- Modal: AI Generator -->', '</div>\n    </div>\n\n    <!-- Modal: AI Videomaker -->');
const strVid = extractBlock('<!-- Modal: AI Videomaker -->', '</div>\n    </div>\n\n    <!-- Modal: Face Swap -->');
const strFace = extractBlock('<!-- Modal: Face Swap -->', '</div>\n    </div>\n  </body>');

// 2. Wrap main Editor in view-panel
html = html.replace(
  'data-testid="@ai-playground-v2/image-editor/container"',
  'id="view-image-editor" class="view-panel grid min-h-full grid-rows-[1fr_auto]" data-testid="@ai-playground-v2/image-editor/container"'
);
html = html.replace('class="grid min-h-full grid-rows-[1fr_auto]"\n                  id="view-image-editor"', 'id="view-image-editor"');

// We need to inject the extracted blocks into the main content area.
// The main content area ends right before: `</section>` around line 712.
// Let's find `<section\n            aria-atomic="false"`

const injectionPoint = html.indexOf('<section\n            aria-atomic="false"');

if (injectionPoint > -1) {
  let newViews = `\n\n<!-- INJECTED VIEWS -->\n`;
  
  const transformView = (str, id, title) => {
    if(!str) return '';
    // Replace outer fixed modal classes with view-panel
    let view = str.replace(/class="tw-fixed tw-inset-0[^"]+"/, `id="${id}" class="view-panel tw-hidden tw-w-full tw-h-full tw-bg-white tw-overflow-y-auto"`);
    // Remove the inner shadow container limits
    view = view.replace(/tw-max-w-4xl|tw-max-w-lg|tw-rounded-2xl|tw-shadow-2xl/g, 'tw-w-full tw-h-full');
    // Remove Close button
    view = view.replace(/<button id="close-[^"]+"[\s\S]*?<\/button>/, '');
    // Replace background of modal body
    view = view.replace(/tw-bg-gray-50/g, 'tw-bg-white');
    return view;
  };

  newViews += transformView(strProj.replace('<!-- Modal: Meus Projetos -->', ''), 'view-projects', 'Meus Projetos');
  newViews += transformView(strGen.replace('<!-- Modal: AI Generator -->', ''), 'view-generate', 'Texto para Imagem');
  newViews += transformView(strVid.replace('<!-- Modal: AI Videomaker -->', ''), 'view-video', 'Animar Imagem');
  newViews += transformView(strFace.replace('<!-- Modal: Face Swap -->', ''), 'view-faceswap', 'Troca de Rosto');

  html = html.substring(0, injectionPoint) + newViews + html.substring(injectionPoint);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('HTML Refactored!');
