import { auth } from './modules/auth.js';
import { navigation } from './modules/navigation.js';
import { text2img } from './modules/text2img.js';
import { editor } from './modules/editor.js';
import { upscale } from './modules/upscale.js';
import { videoModule } from './modules/video.js';
import { faceswap } from './modules/faceswap.js';
import { projects } from './modules/projects.js';
import { billing } from './modules/billing.js';
import { telemetry } from './services/telemetry.js';

/**
 * AI Playground - Main Application Entry Point (ES Module)
 */
class App {
  static async init() {
    console.log('🚀 AGENTEGPT Playground Level 3 Starting...');

    // 1. Initialize Core Services
    auth.init();
    navigation.init();
    projects.init();
    billing.init();
    telemetry.init();

    // 2. Initialize Feature Engines
    text2img.init();
    editor.init();
    upscale.init();
    videoModule.init();
    faceswap.init();
    
    // 3. Set Default View
    navigation.switchView('view-image-editor');

    console.log('✨ Application Ready');
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
