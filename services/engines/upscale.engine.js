import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ProjectsRepository } from '../../repositories/projects.repository.js';

function normalizeIntent(value) {
  const safe = String(value || 'both').toLowerCase();
  return ['quality', 'resize', 'both'].includes(safe) ? safe : 'both';
}

function normalizeFactor(value) {
  const map = {
    '2x': 2,
    '4x': 4,
    '8x': 8
  };
  return map[String(value || '2x').toLowerCase()] || 2;
}

function normalizeQuality(value) {
  const safe = String(value || 'balanced').toLowerCase();
  return ['fast', 'balanced', 'pro'].includes(safe) ? safe : 'balanced';
}

function normalizeOutput(value) {
  const safe = String(value || 'png').toLowerCase();
  return ['png', 'jpeg', 'webp'].includes(safe) ? safe : 'png';
}

function outputExt(format) {
  if (format === 'jpeg') return 'jpg';
  return format;
}

function transformOptionsByProfile(profile) {
  if (profile === 'fast') {
    return { sharpenSigma: 0.7, jpegQuality: 78, webpQuality: 76 };
  }
  if (profile === 'pro') {
    return { sharpenSigma: 1.3, jpegQuality: 94, webpQuality: 92 };
  }
  return { sharpenSigma: 1.0, jpegQuality: 88, webpQuality: 86 };
}

function clampDimensions(width, height, factor) {
  const maxDim = 8192;
  const targetW = Math.max(1, Math.round(width * factor));
  const targetH = Math.max(1, Math.round(height * factor));
  if (targetW <= maxDim && targetH <= maxDim) return { width: targetW, height: targetH };

  const fitRatio = Math.min(maxDim / targetW, maxDim / targetH);
  return {
    width: Math.max(1, Math.floor(targetW * fitRatio)),
    height: Math.max(1, Math.floor(targetH * fitRatio))
  };
}

export class UpscaleEngine {
  static async execute(userId, options = {}) {
    const {
      imageBuffer,
      prompt = '',
      intent: rawIntent,
      factor: rawFactor,
      qualityProfile: rawQualityProfile,
      outputFormat: rawOutputFormat
    } = options;

    if (!imageBuffer) throw new Error('Imagem base ausente para upscale.');

    const cost = Number(process.env.COST_UPSCALE_IMAGE) || 1;
    const intent = normalizeIntent(rawIntent);
    const factor = normalizeFactor(rawFactor);
    const qualityProfile = normalizeQuality(rawQualityProfile);
    const outputFormat = normalizeOutput(rawOutputFormat);
    const operationKey = `upscale:${randomUUID()}`;
    const description = `Upscale(${intent}/${factor}x/${qualityProfile}): ${String(prompt || 'no-prompt').slice(0, 30)}...`;

    await CreditService.reserveCredits({
      userId,
      amount: cost,
      description,
      operationKey
    });

    try {
      const image = sharp(imageBuffer, { failOn: 'none' }).rotate();
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) throw new Error('Nao foi possivel ler dimensoes da imagem.');

      const profileOptions = transformOptionsByProfile(qualityProfile);
      let pipeline = image;

      if (intent === 'resize' || intent === 'both') {
        const target = clampDimensions(metadata.width, metadata.height, factor);
        pipeline = pipeline.resize(target.width, target.height, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3
        });
      }

      if (intent === 'quality' || intent === 'both') {
        pipeline = pipeline.sharpen(profileOptions.sharpenSigma);
      }

      if (outputFormat === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: profileOptions.jpegQuality, mozjpeg: true });
      } else if (outputFormat === 'webp') {
        pipeline = pipeline.webp({ quality: profileOptions.webpQuality });
      } else {
        pipeline = pipeline.png({ compressionLevel: 9 });
      }

      const outputBuffer = await pipeline.toBuffer();
      const imageUrl = await StorageService.save(outputBuffer, 'upscale', outputExt(outputFormat));

      const project = await ProjectsRepository.create({
        userId,
        prompt: prompt || `Upscale ${intent} ${factor}x ${qualityProfile}`,
        imageUrl,
        module: 'upscale'
      });

      await CreditService.captureReservation(operationKey);

      return {
        success: true,
        url: imageUrl,
        project
      };
    } catch (err) {
      await CreditService.releaseReservation(operationKey, `Upscale failure: ${err.message}`);
      throw err;
    }
  }
}

