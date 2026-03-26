import { randomUUID } from 'crypto';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ProjectsRepository } from '../../repositories/projects.repository.js';

export class Text2ImgEngine {
  static async execute(userId, prompt) {
    const cost = Number(process.env.COST_TEXT_TO_IMAGE) || 1;
    const description = `Geracao de Imagem: ${prompt.substring(0, 30)}...`;
    const operationKey = `text2img:${randomUUID()}`;

    await CreditService.reserveCredits({
      userId,
      amount: cost,
      description,
      operationKey
    });

    try {
      const stability = engineFactory.get('stability');
      const imageBuffer = await stability.generate({ prompt });

      const imageUrl = await StorageService.save(imageBuffer, 'gen', 'png');

      const project = await ProjectsRepository.create({
        userId,
        prompt,
        imageUrl,
        module: 'text-to-image'
      });

      await CreditService.captureReservation(operationKey);

      return {
        success: true,
        url: imageUrl,
        project
      };
    } catch (err) {
      console.error('[Engine] Text2Img failed, releasing reservation...', err.message);
      await CreditService.releaseReservation(operationKey, `Text2Img failure: ${err.message}`);
      throw err;
    }
  }
}
