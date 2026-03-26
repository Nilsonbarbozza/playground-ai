import db from '../../config/db.js';
import { VideoJobsRepository } from '../../repositories/video-jobs.repository.js';

export class VideoJobsService {
  static async createSubmittedJob({ userId, providerJobId, prompt, costCredits }) {
    return VideoJobsRepository.createSubmitted({ userId, providerJobId, prompt, costCredits });
  }

  static async getByIdForUser(jobId, userId) {
    return VideoJobsRepository.findByIdAndUser(jobId, userId);
  }

  static async withLock(jobId, userId, callback) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await VideoJobsRepository.findByIdAndUserForUpdateWithClient(client, jobId, userId);

      if (!locked) {
        const err = new Error('Job de video nao encontrado.');
        err.status = 404;
        throw err;
      }

      const output = await callback(client, locked);
      await client.query('COMMIT');
      return output;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async updateStatusWithClient(client, jobId, status, { resultUrl = null, errorMessage = null } = {}) {
    return VideoJobsRepository.updateStatusWithClient(client, jobId, status, { resultUrl, errorMessage });
  }
}
