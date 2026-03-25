import db from '../../config/db.js';
import { engineFactory } from '../ai/engineFactory.js';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';

export class VideoEngine {
  /**
   * Submit a new video generation job
   */
  static async submit(userId, imageBuffer) {
    const cost = Number(process.env.COST_TEXT_TO_VIDEO) || 5;
    const description = `Geração de Vídeo (Job Submission)`;

    // 1. Transactional Credit Deduction (Deduct upfront for Video)
    await CreditService.useCredits(userId, cost, description);

    try {
      const stability = engineFactory.get('stability');
      const jobId = await stability.submitVideoJob(imageBuffer);

      return {
        success: true,
        generation_id: jobId,
        status: 'processing'
      };
    } catch (err) {
      console.error('[Engine] Video submission failed, refunding...', err.message);
      await CreditService.refundCredits(userId, cost, description);
      throw err;
    }
  }

  /**
   * Check status and PERSIST result if finished
   * This is called by the GET route, but we must ensure it's IDEMPOTENT.
   */
  static async checkAndPersist(userId, jobId) {
    const stability = engineFactory.get('stability');
    const response = await stability.getVideoStatus(jobId);

    if (response.status === 202) {
      return { status: 'in-progress' };
    }

    if (response.status === 200) {
      // Finished!
      // Check if we already saved this project to avoid duplicates (Side-effect protection)
      const existing = await db.query(
        'SELECT * FROM projects WHERE prompt LIKE $1 AND module = $2',
        [`%${jobId}%`, 'video']
      );
      
      if (existing.rows.length > 0) {
        return { success: true, status: 'finished', url: existing.rows[0].image_url };
      }

      // Save and Record
      const videoUrl = await StorageService.save(response.data, 'vid', 'mp4');
      await db.query(
        'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4)',
        [userId, `Stability Video: ${jobId}`, videoUrl, 'video']
      );

      return { success: true, status: 'finished', url: videoUrl };
    }

    throw new Error('Estado do vídeo desconhecido ou erro no provedor.');
  }
}
