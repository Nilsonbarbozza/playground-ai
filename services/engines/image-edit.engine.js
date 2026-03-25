import db from '../../config/db.js';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import * as aiHelper from '../../utils/aiHelper.js';

export class ImageEditEngine {
  static async execute(userId, options) {
    const { userPrompt, imageBuffer, maskBuffer } = options;
    const cost = Number(process.env.COST_IMAGE_EDITOR) || 2;

    // 1. Transactional Credit Deduction
    await CreditService.useCredits(userId, cost, `Editor: ${userPrompt.substring(0, 30)}...`);

    try {
      // 2. Pre-processing
      const normalizedBase = await aiHelper.normalizeImage(imageBuffer);
      const inputBase64 = `data:image/png;base64,${normalizedBase.toString('base64')}`;

      // 3. Semantic Analysis (OpenAI)
      const openai = engineFactory.get('openai');
      const analysis = await openai.analyzeIntent(userPrompt, inputBase64);
      
      const intent = analysis.intent || 'EDIT';
      let finalPrompt = analysis.prompt || userPrompt;
      let negPrompt = analysis.negative_prompt || "low quality, text, logos";

      // 4. Advanced Mask Processing & Color Seeding
      let finalMask = null;
      let readyBase = normalizedBase;

      if (maskBuffer) {
        finalMask = await aiHelper.normalizeMask(maskBuffer, intent);
        if (intent === 'EDIT' && analysis.target_hex && analysis.target_hex.startsWith('#')) {
          readyBase = await aiHelper.applyColorSeed(normalizedBase, finalMask, analysis.target_hex);
        }
      }

      // 5. Call AI Provider (Stability)
      const stability = engineFactory.get('stability');
      const outputBuffer = await stability.edit({
        image: readyBase,
        mask: finalMask,
        prompt: finalPrompt,
        negative_prompt: negPrompt,
        intent
      });

      // 6. Persist Asset (REAL PERSISTENCE for Level 3)
      const imageUrl = await StorageService.save(outputBuffer, 'edit', 'png');

      // 7. Create Project Entry
      const projectRes = await db.query(
        'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, finalPrompt, imageUrl, 'image_editor']
      );

      return {
        success: true,
        url: imageUrl, // Fixed URL (not base64 anymore!)
        project: projectRes.rows[0]
      };

    } catch (err) {
      // 8. Automatic Refund
      console.error('[Engine] ImageEdit logic failed, refunding...', err.message);
      await CreditService.refundCredits(userId, cost, `Editor Failure: ${userPrompt}`);
      throw err;
    }
  }
}
