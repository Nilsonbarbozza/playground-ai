import db from '../config/db.js';

export class ProjectsRepository {
  static async create({ userId, prompt, imageUrl, module }) {
    const result = await db.query(
      'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, prompt, imageUrl, module]
    );
    return result.rows[0];
  }

  static async createWithClient(client, { userId, prompt, imageUrl, module }) {
    const result = await client.query(
      'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, prompt, imageUrl, module]
    );
    return result.rows[0];
  }

  static async listByUser(userId) {
    const result = await db.query(
      'SELECT id, prompt, image_url, module, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  static async findVideoProjectByPromptWithClient(client, { userId, prompt }) {
    const result = await client.query(
      `SELECT id, image_url
       FROM projects
       WHERE user_id = $1
         AND module = $2
         AND prompt = $3
       LIMIT 1`,
      [userId, 'video', prompt]
    );
    return result.rows[0] || null;
  }
}
