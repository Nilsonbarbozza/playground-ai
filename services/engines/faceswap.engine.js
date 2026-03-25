import db from '../../config/db.js';
import axios from 'axios';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';

export class FaceSwapEngine {
  static async execute(userId, targetBase64, swapBase64) {
    const cost = Number(process.env.COST_FACESWAP) || 3;
    const description = `Face Swap: AI Generation`;

    // 1. Billing
    await CreditService.useCredits(userId, cost, description);

    try {
      const replicate = engineFactory.get('replicate');
      
      // 2. Start Prediction
      const prediction = await replicate.generate({
        target_image_base64: targetBase64,
        swap_image_base64: swapBase64
      });

      let predictionUrl = prediction.urls.get;
      let predictionStatus = prediction.status;
      let outputUrl = null;

      // 3. Polling (Level 3 should ideally move this to a background worker, 
      // but for now we keep it in the engine to satisfy "Architecture over Files")
      let attempts = 0;
      while (predictionStatus !== 'succeeded' && predictionStatus !== 'failed' && attempts < 20) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        const check = await replicate.getStatus(predictionUrl);
        predictionStatus = check.status;
        if (predictionStatus === 'succeeded') {
          outputUrl = Array.isArray(check.output) ? check.output[0] : check.output;
        } else if (predictionStatus === 'failed') {
          throw new Error('Replicate failed.');
        }
      }

      if (!outputUrl) throw new Error('Timeout.');

      // 4. Download and Persist Asset
      const imgRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
      const finalImageUrl = await StorageService.save(imgRes.data, 'faceswap', 'png');

      // 5. Project Entry
      await db.query(
        'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4)',
        [userId, 'Face Swap Generation', finalImageUrl, 'face-swap']
      );

      return { success: true, url: finalImageUrl };

    } catch (err) {
      await CreditService.refundCredits(userId, cost, description);
      throw err;
    }
  }
}
