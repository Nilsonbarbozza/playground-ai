import { randomUUID } from 'crypto';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import * as aiHelper from '../../utils/aiHelper.js';
import { ProjectsRepository } from '../../repositories/projects.repository.js';

export class ImageEditEngine {
  static async execute(userId, options) {
    const { userPrompt, imageBuffer, maskBuffer } = options;
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
      const finalPrompt = analysis.prompt || userPrompt;
      const negPrompt = analysis.negative_prompt || 'low quality, text, logos';

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
        intent
      });

      const imageUrl = await StorageService.save(outputBuffer, 'edit', 'png');

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
        project
      };
    } catch (err) {
      console.error('[Engine] ImageEdit failed, releasing reservation...', err.message);
      await CreditService.releaseReservation(operationKey, `ImageEdit failure: ${err.message}`);
      throw err;
    }
  }
}
