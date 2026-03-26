import dotenv from 'dotenv';
dotenv.config();

const db = (await import('./config/db.js')).default;

async function migrate() {
  console.log('--- Migracao Level 3 (Full Schema) ---');
  console.log(`[DB] Conectando a: ${process.env.DATABASE_URL?.substring(0, 40)}...`);

  try {
    await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('[OK] Extensao uuid-ossp verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        credits INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[OK] Tabela users criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        prompt TEXT,
        image_url VARCHAR(255) NOT NULL,
        module VARCHAR(50) DEFAULT 'image_editor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[OK] Tabela projects criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[OK] Tabela credit_ledger criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        operation_key VARCHAR(255) UNIQUE NOT NULL,
        amount INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        captured_at TIMESTAMP,
        released_at TIMESTAMP
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON credit_transactions(status)`);
    console.log('[OK] Tabela credit_transactions criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS video_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_job_id VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        prompt TEXT,
        result_url VARCHAR(255),
        error_message TEXT,
        cost_credits INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status)`);
    console.log('[OK] Tabela video_jobs criada/verificada.');

    console.log('\n[OK] Migracao concluida com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('[ERR] Erro na migracao:', err.message);
    process.exit(1);
  }
}

migrate();
