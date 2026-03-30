import { api } from '../services/api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';

/**
 * Text-to-Image Module
 */
export const text2img = {
  prefsKey: 't2i_generation_prefs_v1',
  controlState: {
    stylePresets: ['photographic', 'cinematic', 'digital-art', 'anime', 'comic-book', 'line-art'],
    aspectRatios: ['1:1', '9:16', '16:9', '4:5', '5:4', '3:2', '2:3'],
    profiles: ['fast', 'balanced', 'pro']
  },

  isMemoryEnabled() {
    const toggle = document.getElementById('t2i-save-config-toggle');
    if (!toggle) return false;
    if (toggle.tagName === 'BUTTON') {
      return String(toggle.getAttribute('data-enabled')) === 'true';
    }
    return Boolean(toggle.checked);
  },

  setMemoryEnabled(enabled) {
    const toggle = document.getElementById('t2i-save-config-toggle');
    if (!toggle) return;
    if (toggle.tagName === 'BUTTON') {
      toggle.setAttribute('data-enabled', enabled ? 'true' : 'false');
      toggle.textContent = enabled ? 'Memory: ON' : 'Memory: OFF';
      toggle.classList.toggle('tw-border-[#5666F5]', enabled);
      toggle.classList.toggle('tw-text-[#5666F5]', enabled);
      return;
    }
    toggle.checked = Boolean(enabled);
  },

  loadPrefs() {
    try {
      const raw = localStorage.getItem(this.prefsKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  },

  savePrefs() {
    const styleBtn = document.getElementById('t2i-style-btn');
    const aspectBtn = document.getElementById('t2i-aspect-btn');
    const profileBtn = document.getElementById('t2i-profile-btn');
    const seedInput = document.getElementById('t2i-seed-input');

    if (!this.isMemoryEnabled()) return;

    const payload = {
      enabled: true,
      style_preset: styleBtn?.getAttribute('data-value') || this.controlState.stylePresets[0],
      aspect_ratio: aspectBtn?.getAttribute('data-value') || this.controlState.aspectRatios[0],
      profile: profileBtn?.getAttribute('data-value') || this.controlState.profiles[1],
      seed: String(seedInput?.value || '').trim()
    };

    try {
      localStorage.setItem(this.prefsKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures in UI flow.
    }
  },

  clearPrefs() {
    try {
      localStorage.removeItem(this.prefsKey);
    } catch {
      // Ignore storage failures in UI flow.
    }
  },

  applyPrefs() {
    const styleBtn = document.getElementById('t2i-style-btn');
    const aspectBtn = document.getElementById('t2i-aspect-btn');
    const aspectLabel = document.getElementById('t2i-aspect-label');
    const profileBtn = document.getElementById('t2i-profile-btn');
    const profileLabel = document.getElementById('t2i-profile-label');
    const seedInput = document.getElementById('t2i-seed-input');
    const saved = this.loadPrefs();

    if (!saved?.enabled) return;

    this.setMemoryEnabled(true);

    if (styleBtn && this.controlState.stylePresets.includes(saved.style_preset)) {
      styleBtn.setAttribute('data-value', saved.style_preset);
      styleBtn.textContent = saved.style_preset;
    }

    if (aspectBtn && aspectLabel && this.controlState.aspectRatios.includes(saved.aspect_ratio)) {
      aspectBtn.setAttribute('data-value', saved.aspect_ratio);
      aspectLabel.textContent = saved.aspect_ratio;
    }

    if (profileBtn && profileLabel && this.controlState.profiles.includes(saved.profile)) {
      profileBtn.setAttribute('data-value', saved.profile);
      profileLabel.textContent = saved.profile;
    }

    if (seedInput) {
      seedInput.value = saved.seed || '';
    }
  },

  initControls() {
    const styleBtn = document.getElementById('t2i-style-btn');
    const aspectBtn = document.getElementById('t2i-aspect-btn');
    const aspectLabel = document.getElementById('t2i-aspect-label');
    const profileBtn = document.getElementById('t2i-profile-btn');
    const profileLabel = document.getElementById('t2i-profile-label');
    const seedInput = document.getElementById('t2i-seed-input');
    const saveToggle = document.getElementById('t2i-save-config-toggle');

    if (styleBtn) {
      styleBtn.addEventListener('click', () => {
        const current = String(styleBtn.getAttribute('data-value') || this.controlState.stylePresets[0]);
        const currentIdx = this.controlState.stylePresets.indexOf(current);
        const nextIdx = (currentIdx + 1) % this.controlState.stylePresets.length;
        const next = this.controlState.stylePresets[nextIdx];
        styleBtn.setAttribute('data-value', next);
        styleBtn.textContent = next;
        this.savePrefs();
      });
    }

    if (aspectBtn && aspectLabel) {
      aspectBtn.addEventListener('click', () => {
        const current = String(aspectBtn.getAttribute('data-value') || this.controlState.aspectRatios[0]);
        const currentIdx = this.controlState.aspectRatios.indexOf(current);
        const nextIdx = (currentIdx + 1) % this.controlState.aspectRatios.length;
        const next = this.controlState.aspectRatios[nextIdx];
        aspectBtn.setAttribute('data-value', next);
        aspectLabel.textContent = next;
        this.savePrefs();
      });
    }

    if (profileBtn && profileLabel) {
      profileBtn.addEventListener('click', () => {
        const current = String(profileBtn.getAttribute('data-value') || this.controlState.profiles[1]);
        const currentIdx = this.controlState.profiles.indexOf(current);
        const nextIdx = (currentIdx + 1) % this.controlState.profiles.length;
        const next = this.controlState.profiles[nextIdx];
        profileBtn.setAttribute('data-value', next);
        profileLabel.textContent = next;
        this.savePrefs();
      });
    }

    if (seedInput) {
      seedInput.addEventListener('input', () => this.savePrefs());
    }

    if (saveToggle) {
      saveToggle.addEventListener('click', () => {
        const next = !this.isMemoryEnabled();
        this.setMemoryEnabled(next);
        if (next) this.savePrefs();
        else this.clearPrefs();
      });

      if (saveToggle.tagName !== 'BUTTON') {
        saveToggle.addEventListener('change', () => {
          if (this.isMemoryEnabled()) this.savePrefs();
          else this.clearPrefs();
        });
      }

      if (saveToggle.tagName === 'BUTTON') {
        this.setMemoryEnabled(this.isMemoryEnabled());
      } else {
        if (this.isMemoryEnabled()) this.savePrefs();
        else this.clearPrefs();
      }
    }

    this.applyPrefs();
  },

  buildPayload(prompt) {
    const styleBtn = document.getElementById('t2i-style-btn');
    const aspectBtn = document.getElementById('t2i-aspect-btn');
    const profileBtn = document.getElementById('t2i-profile-btn');
    const seedInput = document.getElementById('t2i-seed-input');

    const payload = {
      prompt,
      style_preset: styleBtn?.getAttribute('data-value') || undefined,
      aspect_ratio: aspectBtn?.getAttribute('data-value') || undefined,
      profile: profileBtn?.getAttribute('data-value') || 'balanced'
    };

    const seedRaw = String(seedInput?.value || '').trim();
    if (seedRaw !== '') {
      const parsedSeed = Number.parseInt(seedRaw, 10);
      if (Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 4294967294) {
        payload.seed = parsedSeed;
      }
    }

    payload.negative_prompt = 'blurry, low quality, artifacts, watermark, text, logo, deformed';

    return payload;
  },

  init() {
    const btn = document.getElementById('btn-generate-t2i');
    const input = document.getElementById('t2i-prompt');
    const previewImg = document.getElementById('t2i-preview-img');
    const loader = document.getElementById('t2i-loader');
    const placeholder = document.getElementById('t2i-placeholder');
    const errorDiv = document.getElementById('t2i-error');

    if (!btn || !input) return;
    this.initControls();

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

        const payload = this.buildPayload(prompt);
        const data = await api.post('/generate', payload);
        
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
