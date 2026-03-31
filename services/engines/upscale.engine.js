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

function normalizeFit(value) {
  const safe = String(value || 'cover').toLowerCase();
  return ['cover', 'contain', 'fill'].includes(safe) ? safe : 'cover';
}

function normalizeDimension(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 8192);
}

function presetDimensions(value) {
  const preset = String(value || '').toLowerCase();
  const map = {
    reels: { width: 1080, height: 1920 },
    stories: { width: 1080, height: 1920 },
    youtube: { width: 1280, height: 720 },
    shorts: { width: 1080, height: 1920 },
    linkedin: { width: 1200, height: 627 },
    square: { width: 1080, height: 1080 }
  };
  return map[preset] || null;
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
      intent: rawIntent,
      factor: rawFactor,
      qualityProfile: rawQualityProfile,
      outputFormat: rawOutputFormat,
      sizePreset: rawSizePreset,
      width: rawWidth,
      height: rawHeight,
      fit: rawFit
    } = options;

    if (!imageBuffer) throw new Error('Imagem base ausente para upscale.');

    const cost = Number(process.env.COST_UPSCALE_IMAGE) || 1;
    const intent = normalizeIntent(rawIntent);
    const factor = normalizeFactor(rawFactor);
    const qualityProfile = normalizeQuality(rawQualityProfile);
    const outputFormat = normalizeOutput(rawOutputFormat);
    const fit = normalizeFit(rawFit);
    const sizePreset = String(rawSizePreset || '').toLowerCase();
    const width = normalizeDimension(rawWidth);
    const height = normalizeDimension(rawHeight);
    const presetSize = presetDimensions(sizePreset);
    const operationKey = `upscale:${randomUUID()}`;
    const explicitSize = width && height ? `${width}x${height}` : null;
    const presetLabel = presetSize ? `${presetSize.width}x${presetSize.height}` : null;
    const resizeLabel = explicitSize || presetLabel || `${factor}x`;
    const description = `Upscale(${intent}/${resizeLabel}/${qualityProfile}/${outputFormat})`;

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

      const hasExplicitTarget = Boolean(explicitSize || presetSize);
      const shouldResize = hasExplicitTarget || intent === 'resize' || intent === 'both';
      if (shouldResize) {
        const target = explicitSize
          ? { width, height }
          : presetSize || clampDimensions(metadata.width, metadata.height, factor);

        pipeline = pipeline.resize(target.width, target.height, {
          fit,
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
        prompt: `Upscale ${intent} ${resizeLabel} ${qualityProfile} ${outputFormat} fit:${fit}`,
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
