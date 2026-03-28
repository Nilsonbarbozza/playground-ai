import db from '../config/db.js';

export class AbExperimentConfigsRepository {
  static async findByKey(key) {
    const result = await db.query(
      `SELECT key, config, updated_by, created_at, updated_at
       FROM ab_experiment_configs
       WHERE key = $1`,
      [key]
    );
    return result.rows[0] || null;
  }

  static async upsertByKey({ key, config, updatedBy }) {
    const result = await db.query(
      `INSERT INTO ab_experiment_configs (key, config, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (key)
       DO UPDATE SET
         config = EXCLUDED.config,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING key, config, updated_by, created_at, updated_at`,
      [key, JSON.stringify(config), updatedBy || null]
    );
    return result.rows[0];
  }
}
