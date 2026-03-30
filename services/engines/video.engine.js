import { engineFactory } from '../ai/engineFactory.js';
import { randomUUID } from 'crypto';
import { CreditService } from '../billing/credits.service.js';
import { StorageService } from '../storage/storage.service.js';
import { VideoJobsService } from '../jobs/video-jobs.service.js';
import { ProjectsService } from '../projects/projects.service.js';

export class VideoEngine {
  static async submit(userId, { imageBuffer, prompt, cfg_scale, motion_bucket_id, seed, profile }) {
    const cost = Number(process.env.COST_TEXT_TO_VIDEO) || 5;
    const description = 'Geracao de Video (Job Submission)';
    const operationKey = `video-submit:${randomUUID()}`;

    await CreditService.reserveCredits({
      userId,
      amount: cost,
      description,
      operationKey
    });

    try {
      const selectedProfile = String(profile || 'balanced').toLowerCase();
      const profileDefaults =
        selectedProfile === 'fast'
          ? { cfg_scale: 1.5, motion_bucket_id: 90 }
          : selectedProfile === 'pro'
          ? { cfg_scale: 2.2, motion_bucket_id: 140 }
          : { cfg_scale: 1.8, motion_bucket_id: 127 };

      const stability = engineFactory.get('stability');
      const providerJobId = await stability.submitVideoJob({
        imageBuffer,
        cfg_scale: cfg_scale ?? profileDefaults.cfg_scale,
        motion_bucket_id: motion_bucket_id ?? profileDefaults.motion_bucket_id,
        seed,
        userId,
        module: 'video-submit'
      });

      const job = await VideoJobsService.createSubmittedJob({
        userId,
        providerJobId,
        prompt,
        costCredits: cost
      });

      await CreditService.captureReservation(operationKey);

      return {
        success: true,
        job_id: job.id,
        provider_job_id: providerJobId,
        status: job.status
      };
    } catch (err) {
      console.error('[Engine] Video submission failed, releasing reservation...', err.message);
      await CreditService.releaseReservation(operationKey, `Video submit failure: ${err.message}`);
      throw err;
    }
  }

  static async getStatus(userId, jobId) {
    const job = await VideoJobsService.getByIdForUser(jobId, userId);
    if (!job) {
      const err = new Error('Job de video nao encontrado.');
      err.status = 404;
      throw err;
    }

    return {
      success: true,
      job_id: job.id,
      status: job.status,
      url: job.result_url || null,
      error: job.error_message || null
    };
  }

  static async syncStatus(userId, jobId) {
    return VideoJobsService.withLock(jobId, userId, async (client, job) => {
      if (job.status === 'finished' || job.status === 'failed') {
        return {
          success: true,
          job_id: job.id,
          status: job.status,
          url: job.result_url || null,
          error: job.error_message || null
        };
      }

      const stability = engineFactory.get('stability');
      const response = await stability.getVideoStatus(job.provider_job_id, {
        userId,
        module: 'video-status-sync'
      });

      if (response.status === 202) {
        const updated = await VideoJobsService.updateStatusWithClient(client, job.id, 'processing');
        return {
          success: true,
          job_id: updated.id,
          status: updated.status,
          url: null,
          error: null
        };
      }

      if (response.status === 200) {
        const videoUrl = await StorageService.save(response.data, 'vid', 'mp4');

        await ProjectsService.createVideoProjectIfMissingWithClient(client, {
          userId,
          providerJobId: job.provider_job_id,
          videoUrl
        });

        const updated = await VideoJobsService.updateStatusWithClient(client, job.id, 'finished', {
          resultUrl: videoUrl,
          errorMessage: null
        });

        return {
          success: true,
          job_id: updated.id,
          status: updated.status,
          url: updated.result_url
        };
      }

      const updated = await VideoJobsService.updateStatusWithClient(client, job.id, 'failed', {
        errorMessage: `Provider status inesperado: ${response.status}`
      });

      return {
        success: false,
        job_id: updated.id,
        status: updated.status,
        error: updated.error_message
      };
    });
  }
}
