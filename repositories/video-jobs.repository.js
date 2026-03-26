import db from '../config/db.js';

export class VideoJobsRepository {
  static async createSubmitted({ userId, providerJobId, prompt, costCredits }) {
    const result = await db.query(
      `INSERT INTO video_jobs (user_id, provider_job_id, status, prompt, cost_credits)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, providerJobId, 'processing', prompt || null, costCredits]
    );
    return result.rows[0];
  }

  static async findByIdAndUser(jobId, userId) {
    const result = await db.query(
      `SELECT *
       FROM video_jobs
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );
    return result.rows[0] || null;
  }

  static async findByIdAndUserForUpdateWithClient(client, jobId, userId) {
    const result = await client.query(
      `SELECT *
       FROM video_jobs
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [jobId, userId]
    );
    return result.rows[0] || null;
  }

  static async updateStatusWithClient(
    client,
    jobId,
    status,
    { resultUrl = null, errorMessage = null } = {}
  ) {
    const result = await client.query(
      `UPDATE video_jobs
       SET status = $2,
           result_url = COALESCE($3, result_url),
           error_message = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [jobId, status, resultUrl, errorMessage]
    );
    return result.rows[0];
  }
}
