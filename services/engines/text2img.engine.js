import db from '../../config/db.js';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';

export class Text2ImgEngine {
  static async execute(userId, prompt) {
    const cost = 1;
    const description = `Geração de Imagem: ${prompt.substring(0, 30)}...`;

    // 1. Transactional Credit Deduction
    await CreditService.useCredits(userId, cost, description);

    try {
      // 2. Call AI Provider
      const stability = engineFactory.get('stability');
      const imageBuffer = await stability.generate({ prompt });

      // 3. Persist Asset
      const imageUrl = await StorageService.save(imageBuffer, 'gen', 'png');

      // 4. Create Project Entry
      const projectRes = await db.query(
        'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, prompt, imageUrl, 'text-to-image']
      );

      return {
        success: true,
        url: imageUrl,
        project: projectRes.rows[0]
      };
    } catch (err) {
      // 5. Automatic Refund on Failure
      console.error('[Engine] Text2Img logic failed, refunding...', err.message);
      await CreditService.refundCredits(userId, cost, description);
      throw err;
    }
  }
}
