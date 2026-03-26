import { randomUUID } from 'crypto';
import axios from 'axios';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ProjectsRepository } from '../../repositories/projects.repository.js';

export class FaceSwapEngine {
  static async execute(userId, targetBase64, swapBase64) {
    const cost = Number(process.env.COST_FACESWAP) || 3;
    const description = 'Face Swap: AI Generation';
    const operationKey = `faceswap:${randomUUID()}`;

    await CreditService.reserveCredits({
      userId,
      amount: cost,
      description,
      operationKey
    });

    try {
      const replicate = engineFactory.get('replicate');

      const prediction = await replicate.generate({
        target_image_base64: targetBase64,
        swap_image_base64: swapBase64
      });

      let predictionUrl = prediction.urls.get;
      let predictionStatus = prediction.status;
      let outputUrl = null;

      let attempts = 0;
      while (predictionStatus !== 'succeeded' && predictionStatus !== 'failed' && attempts < 20) {
        await new Promise((r) => setTimeout(r, 2000));
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

      const imgRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
      const finalImageUrl = await StorageService.save(imgRes.data, 'faceswap', 'png');

      await ProjectsRepository.create({
        userId,
        prompt: 'Face Swap Generation',
        imageUrl: finalImageUrl,
        module: 'face-swap'
      });

      await CreditService.captureReservation(operationKey);

      return { success: true, url: finalImageUrl };
    } catch (err) {
      await CreditService.releaseReservation(operationKey, `FaceSwap failure: ${err.message}`);
      throw err;
    }
  }
}
