const fs = require('fs');
let js = fs.readFileSync('scripts/main.js', 'utf8');
js = js.replace(/initProjectsModal\(.*?initFaceSwapModal\(\);/s, 'initNavigation();\n    initVideoGenerator();\n    initFaceSwapGenerator();');
fs.writeFileSync('scripts/main.js', js, 'utf8');
