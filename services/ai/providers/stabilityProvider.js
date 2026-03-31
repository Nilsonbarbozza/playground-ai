import axios from 'axios';
import FormData from 'form-data';
import { BaseProvider } from '../baseProvider.js';
import { TelemetryInternalService } from '../../telemetry/telemetry-internal.service.js';

function asInt(value, fallback, min = null, max = null) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  const withMin = min == null ? n : Math.max(n, min);
  return max == null ? withMin : Math.min(withMin, max);
}

function asFloat(value, fallback, min = null, max = null) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  const withMin = min == null ? n : Math.max(n, min);
  return max == null ? withMin : Math.min(withMin, max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractProviderBody(err) {
  try {
    const raw = err?.response?.data;
    if (!raw) return '';
    if (Buffer.isBuffer(raw)) return raw.toString('utf8').slice(0, 400);
    if (typeof raw === 'string') return raw.slice(0, 400);
    return JSON.stringify(raw).slice(0, 400);
  } catch {
    return '';
  }
}

export class StabilityProvider extends BaseProvider {
  async requestWithRetry({ requestFn, telemetry = {}, params = {} }) {
    const retries = asInt(process.env.STABILITY_RETRY_ATTEMPTS, 2, 0, 5);
    const timeoutMs = asInt(process.env.STABILITY_TIMEOUT_MS, 60000, 5000, 180000);
    const backoffBaseMs = asInt(process.env.STABILITY_RETRY_BACKOFF_MS, 700, 100, 5000);
    const maxAttempts = retries + 1;

    let lastErr = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await requestFn({ timeoutMs });
        await TelemetryInternalService.trackProviderCall({
          ...telemetry,
          status: 'success',
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
          params
        });
        return response;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status || null;
        const code = err?.code || null;
        const retryable =
          attempt < maxAttempts &&
          (!status || status >= 500 || status === 429 || code === 'ECONNABORTED' || code === 'ETIMEDOUT');

        if (!retryable) {
          await TelemetryInternalService.trackProviderCall({
            ...telemetry,
            status: 'error',
            attempts: attempt,
            latencyMs: Date.now() - startedAt,
            params,
            errorCode: code || (status ? `HTTP_${status}` : 'REQUEST_ERROR'),
            errorMessage: err?.message || 'Unknown provider error'
          });
          throw err;
        }

        await sleep(backoffBaseMs * 2 ** (attempt - 1));
      }
    }

    throw lastErr || new Error('Stability request failed unexpectedly.');
  }

  /**
   * Text-to-Image Generation (Model: Core)
   * @param {Object} options { prompt: string }
   */
  async generate(options) {
    const {
      prompt,
      negative_prompt,
      aspect_ratio,
      seed,
      output_format,
      style_preset,
      userId = null,
      module = 'text-to-image'
    } = options || {};
    const formData = new FormData();
    formData.append('prompt', prompt);
    if (negative_prompt) formData.append('negative_prompt', String(negative_prompt));
    if (aspect_ratio) formData.append('aspect_ratio', String(aspect_ratio));
    if (style_preset) formData.append('style_preset', String(style_preset));
    if (seed != null && seed !== '') formData.append('seed', String(asInt(seed, 0, 0)));
    formData.append('output_format', output_format || 'png');

    const params = {
      aspect_ratio: aspect_ratio || null,
      has_negative_prompt: Boolean(negative_prompt),
      seed: seed != null ? asInt(seed, 0, 0) : null,
      output_format: output_format || 'png',
      style_preset: style_preset || null
    };

    const response = await this.requestWithRetry({
      telemetry: {
        userId,
        module,
        provider: 'stability',
        model: 'stable-image-core',
        operation: 'generate'
      },
      params,
      requestFn: ({ timeoutMs }) =>
        axios.post(
          'https://api.stability.ai/v2beta/stable-image/generate/core',
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: "image/*"
            },
            responseType: 'arraybuffer',
            timeout: timeoutMs
          }
        )
    });

    if (response.status !== 200) {
      throw new Error(`Stability API Error: ${response.data.toString()}`);
    }

    return response.data; // Buffer
  }

  /**
   * Inpaint or Erase (Model: Edit)
   * @param {Object} options { image: Buffer, mask: Buffer, prompt: string, negative_prompt: string, intent: 'EDIT'|'ERASE' }
   */
  async edit(options) {
    const {
      image,
      mask,
      prompt,
      negative_prompt,
      intent,
      seed,
      output_format,
      userId = null,
      module = 'image-editor'
    } = options || {};
    
    const endpoint = intent === 'ERASE' 
      ? 'https://api.stability.ai/v2beta/stable-image/edit/erase'
      : 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';

    const formData = new FormData();
    formData.append('image', image, { filename: 'image.png', contentType: 'image/png' });
    
    if (mask) {
      formData.append('mask', mask, { filename: 'mask.png', contentType: 'image/png' });
    }

    if (intent === 'EDIT') {
      formData.append('prompt', prompt);
      if (negative_prompt) formData.append('negative_prompt', negative_prompt);
    }
    
    formData.append('seed', String(asInt(seed, 0, 0)));
    formData.append('output_format', output_format || 'png');

    const response = await this.requestWithRetry({
      telemetry: {
        userId,
        module,
        provider: 'stability',
        model: 'stable-image-edit',
        operation: intent === 'ERASE' ? 'erase' : 'inpaint'
      },
      params: {
        intent,
        has_mask: Boolean(mask),
        has_negative_prompt: Boolean(negative_prompt),
        seed: asInt(seed, 0, 0),
        output_format: output_format || 'png'
      },
      requestFn: ({ timeoutMs }) =>
        axios.post(
          endpoint,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${this.apiKey}`,
              Accept: "image/*"
            },
            responseType: 'arraybuffer',
            timeout: timeoutMs
          }
        )
    });

    if (response.status !== 200) {
      throw new Error(`Stability AI Edit (${intent}) Error: ${response.data.toString()}`);
    }

    return response.data; // Buffer
  }

  /**
   * Image-to-Video Animation
   */
  async submitVideoJob(input) {
    const options = Buffer.isBuffer(input) ? { imageBuffer: input } : (input || {});
    const {
      imageBuffer,
      cfg_scale,
      motion_bucket_id,
      seed,
      userId = null,
      module = 'video'
    } = options;
    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'image.png', contentType: 'image/png' });
    const safeSeed = asInt(seed, 0, 0);
    const safeCfgScale = asFloat(cfg_scale, 1.8, 0.1, 10);
    const safeMotion = asInt(motion_bucket_id, 127, 1, 255);
    formData.append('seed', String(safeSeed));
    formData.append('cfg_scale', String(safeCfgScale));
    formData.append('motion_bucket_id', String(safeMotion));

    const endpoints = [
      'https://api.stability.ai/v2beta/image-to-video',
      'https://api.stability.ai/v2alpha/image-to-video',
      'https://api.stability.ai/v2alpha/generation/image-to-video'
    ];

    let lastErr = null;
    const attempts = [];
    for (const endpoint of endpoints) {
      try {
        const submitData = new FormData();
        submitData.append('image', imageBuffer, { filename: 'image.png', contentType: 'image/png' });
        submitData.append('seed', String(safeSeed));
        submitData.append('cfg_scale', String(safeCfgScale));
        submitData.append('motion_bucket_id', String(safeMotion));

        const response = await this.requestWithRetry({
          telemetry: {
            userId,
            module,
            provider: 'stability',
            model: 'image-to-video',
            operation: 'submit_video_job'
          },
          params: {
            endpoint,
            seed: safeSeed,
            cfg_scale: safeCfgScale,
            motion_bucket_id: safeMotion
          },
          requestFn: ({ timeoutMs }) =>
            axios.post(
              endpoint,
              submitData,
              {
                headers: {
                  ...submitData.getHeaders(),
                  Authorization: `Bearer ${this.apiKey}`
                },
                timeout: timeoutMs
              }
            )
        });

        return response.data.id;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        attempts.push(`${endpoint} -> ${status || err?.code || 'error'}`);
        if (status === 404) continue;
        throw err;
      }
    }

    const diag = attempts.length ? ` Endpoints testados: ${attempts.join(' | ')}` : '';
    const reason = lastErr?.message ? ` Motivo: ${lastErr.message}` : '';
    const providerBody = extractProviderBody(lastErr);
    const detail = providerBody ? ` Provider: ${providerBody}` : '';
    throw new Error(`Falha ao submeter job de video na Stability.${reason}${diag}${detail}`);
  }

  async getVideoStatus(jobId, options = {}) {
    const { userId = null, module = 'video' } = options;
    const endpoints = [
      `https://api.stability.ai/v2beta/image-to-video/result/${jobId}`,
      `https://api.stability.ai/v2alpha/image-to-video/result/${jobId}`,
      `https://api.stability.ai/v2alpha/generation/image-to-video/result/${jobId}`
    ];

    let lastErr = null;
    const attempts = [];
    for (const endpoint of endpoints) {
      try {
        const response = await this.requestWithRetry({
          telemetry: {
            userId,
            module,
            provider: 'stability',
            model: 'image-to-video',
            operation: 'get_video_status'
          },
          params: { endpoint, job_id: String(jobId || '').slice(0, 80) },
          requestFn: ({ timeoutMs }) =>
            axios.get(
              endpoint,
              {
                headers: {
                  Authorization: `Bearer ${this.apiKey}`,
                  Accept: 'video/*'
                },
                responseType: 'arraybuffer',
                validateStatus: undefined,
                timeout: timeoutMs
              }
            )
        });
        return response;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        attempts.push(`${endpoint} -> ${status || err?.code || 'error'}`);
        if (status === 404) continue;
        throw err;
      }
    }

    const diag = attempts.length ? ` Endpoints testados: ${attempts.join(' | ')}` : '';
    const reason = lastErr?.message ? ` Motivo: ${lastErr.message}` : '';
    const providerBody = extractProviderBody(lastErr);
    const detail = providerBody ? ` Provider: ${providerBody}` : '';
    throw new Error(`Falha ao consultar status do video na Stability.${reason}${diag}${detail}`);
  }
}
