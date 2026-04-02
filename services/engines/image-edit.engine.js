import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import * as aiHelper from '../../utils/aiHelper.js';
import { ProjectsRepository } from '../../repositories/projects.repository.js';

export class ImageEditEngine {
  static async execute(userId, options) {
    const { userPrompt, imageBuffer, maskBuffer, seed, output_format } = options;
    const allowedOutputFormats = new Set(['png', 'jpeg', 'webp']);
    let normalizedOutputFormat = String(output_format || '').toLowerCase().trim();
    
    // Alias comum: jpg -> jpeg
    if (normalizedOutputFormat === 'jpg') normalizedOutputFormat = 'jpeg';

    // Se o formato enviado não for reconhecido ou for o padrão (png), tentamos o smart fallback pelo prompt
    if (!allowedOutputFormats.has(normalizedOutputFormat) || normalizedOutputFormat === 'png') {
      const promptLower = String(userPrompt).toLowerCase();
      if (promptLower.includes('webp')) normalizedOutputFormat = 'webp';
      else if (promptLower.includes('jpg') || promptLower.includes('jpeg')) normalizedOutputFormat = 'jpeg';
    }

    let safeOutputFormat = allowedOutputFormats.has(normalizedOutputFormat)
      ? normalizedOutputFormat
      : 'png';
    const finalExt = safeOutputFormat === 'jpeg' ? 'jpg' : safeOutputFormat;
    const parsedSeed = Number.parseInt(seed, 10);
    const safeSeed = Number.isInteger(parsedSeed) && parsedSeed >= 0 ? parsedSeed : 0;
    const cost = Number(process.env.COST_IMAGE_EDITOR) || 2;
    const description = `Editor: ${userPrompt.substring(0, 30)}...`;
    const operationKey = `image-edit:${randomUUID()}`;

    await CreditService.reserveCredits({
      userId,
      amount: cost,
      description,
      operationKey
    });

    try {
      const normalizedBase = await aiHelper.normalizeImage(imageBuffer);
      const inputBase64 = `data:image/png;base64,${normalizedBase.toString('base64')}`;

      const openai = engineFactory.get('openai');
      const analysis = await openai.analyzeIntent(userPrompt, inputBase64);

      const intent = analysis.intent || 'EDIT';
      let finalPrompt = analysis.prompt || userPrompt;
      let negPrompt = analysis.negative_prompt || 'low quality, text, logos';

      if (intent === 'EDIT') {
        const antiMutationConstraints = 'mutated, changed shape, different model, deformed, distorted, cartoon, artificial, new additions, extra parts, 3d render';
        negPrompt = `${negPrompt}, ${antiMutationConstraints}`;
        
        if (analysis.target_hex && analysis.target_color_name && analysis.target_color_name.trim() !== '') {
          const c = analysis.target_color_name.trim();
          finalPrompt = `${finalPrompt}, colored strictly ${c}, pure ${c}, ${c} surface, 100% ${c}`;
        }
      }

      let finalMask = null;
      let readyBase = normalizedBase;

      if (maskBuffer) {
        finalMask = await aiHelper.normalizeMask(maskBuffer, intent);
        if (intent === 'EDIT' && analysis.target_hex && analysis.target_hex.startsWith('#')) {
          readyBase = await aiHelper.applyColorSeed(normalizedBase, finalMask, analysis.target_hex);
        }
      }

      const stability = engineFactory.get('stability');
      const outputBuffer = await stability.edit({
        image: readyBase,
        mask: finalMask,
        prompt: finalPrompt,
        negative_prompt: negPrompt,
        intent,
        seed: safeSeed,
        output_format: safeOutputFormat,
        userId,
        module: 'image-editor'
      });

      // --- RESTAURAR TRANSPARÊNCIA ORIGINAL ---
      // A Stability AI não lida bem com fundos transparentes (gera ruído/preto no fundo).
      // Agora usamos o Alpha original como um "Stencil" (máscara de corte) sobre o resultado da IA.
      let finalOutputBuffer = outputBuffer;
      const originalMetadata = await sharp(imageBuffer).metadata();
      
      if (originalMetadata.hasAlpha && (safeOutputFormat === 'png' || safeOutputFormat === 'webp')) {
        const outMeta = await sharp(outputBuffer).metadata();
        const extractedAlpha = await sharp(imageBuffer)
          .ensureAlpha()
          .extractChannel(3) // Pega apenas a transparência original
          .resize(outMeta.width, outMeta.height)
          .toBuffer();
          
        finalOutputBuffer = await sharp(outputBuffer)
          .ensureAlpha()
          .composite([{ 
            input: extractedAlpha, 
            blend: 'dest-in' // Corta o resultado da IA exatamente no formato da silhueta original
          }])
          .toFormat(safeOutputFormat)
          .toBuffer();
      } else {
        finalOutputBuffer = await sharp(outputBuffer).toFormat(safeOutputFormat).toBuffer();
      }

      const imageUrl = await StorageService.save(finalOutputBuffer, 'edit', finalExt);

      const project = await ProjectsRepository.create({
        userId,
        prompt: finalPrompt,
        imageUrl,
        module: 'image_editor'
      });

      await CreditService.captureReservation(operationKey);

      return {
        success: true,
        url: imageUrl,
        project,
        applied: {
          seed: safeSeed,
          output_format: safeOutputFormat
        }
      };
    } catch (err) {
      console.error('[Engine] ImageEdit failed, releasing reservation...', err.message);
      await CreditService.releaseReservation(operationKey, `ImageEdit failure: ${err.message}`);
      throw err;
    }
  }
}
