import { randomUUID } from 'crypto';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ProjectsRepository } from '../../repositories/projects.repository.js';

export class Text2ImgEngine {
  static async execute(userId, prompt, options = {}) {
    const cost = Number(process.env.COST_TEXT_TO_IMAGE) || 1;
    const description = `Geracao de Imagem: ${prompt.substring(0, 30)}...`;
    const operationKey = `text2img:${randomUUID()}`;
    const profile = String(options?.profile || 'balanced').toLowerCase();

    const profileDefaults =
      profile === 'fast'
        ? { output_format: 'jpeg' }
        : profile === 'pro'
        ? { output_format: 'png' }
        : { output_format: 'png' };
    const finalOutputFormat = options?.output_format || profileDefaults.output_format;
    const finalExt = finalOutputFormat === 'webp' ? 'webp' : finalOutputFormat === 'jpeg' ? 'jpg' : 'png';

    await CreditService.reserveCredits({
      userId,
      amount: cost,
      description,
      operationKey
    });

    try {
      const openai = engineFactory.get('openai');
      const enhanced = await openai.enhanceTextToImagePrompt(prompt, options?.style_preset);
      
      const finalPrompt = enhanced.final_prompt || prompt;
      let finalNegativePrompt = enhanced.negative_prompt || 'low quality, blurry, deformed';
      
      if (options?.negative_prompt) {
        finalNegativePrompt = `${options.negative_prompt}, ${finalNegativePrompt}`;
      }

      const stability = engineFactory.get('stability');
      const imageBuffer = await stability.generate({
        prompt: finalPrompt,
        negative_prompt: finalNegativePrompt,
        aspect_ratio: options?.aspect_ratio || null,
        seed: options?.seed,
        output_format: finalOutputFormat,
        style_preset: options?.style_preset || null,
        userId,
        module: 'text-to-image'
      });

      const imageUrl = await StorageService.save(imageBuffer, 'gen', finalExt);

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
