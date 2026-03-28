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
      CREATE TABLE IF NOT EXISTS credit_packages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        price_brl_cents INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        stripe_price_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[OK] Tabela credit_packages criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        package_id UUID NOT NULL REFERENCES credit_packages(id),
        credits INTEGER NOT NULL,
        amount_brl_cents INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'brl',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        stripe_checkout_session_id VARCHAR(255) UNIQUE,
        stripe_payment_intent_id VARCHAR(255),
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_credit_orders_user_id ON credit_orders(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_credit_orders_status ON credit_orders(status)`);
    console.log('[OK] Tabela credit_orders criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, event_id)
      )
    `);
    console.log('[OK] Tabela webhook_events criada/verificada.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id BIGSERIAL PRIMARY KEY,
        event_name VARCHAR(120) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(120),
        view_id VARCHAR(120),
        route_or_feature VARCHAR(180),
        level VARCHAR(40),
        error_code VARCHAR(120),
        error_message_short VARCHAR(350),
        source VARCHAR(40) NOT NULL DEFAULT 'web',
        props JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON telemetry_events(created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_name ON telemetry_events(event_name)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_id ON telemetry_events(user_id)`);
    console.log('[OK] Tabela telemetry_events criada/verificada.');

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

    await db.query(
      `INSERT INTO credit_packages (code, name, price_brl_cents, credits, active)
       VALUES ('starter-500', 'Starter 500 Creditos', 5000, 500, true)
       ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           price_brl_cents = EXCLUDED.price_brl_cents,
           credits = EXCLUDED.credits,
           active = EXCLUDED.active`
    );
    console.log('[OK] Pacote starter-500 criado/verificado.');

    console.log('\n[OK] Migracao concluida com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('[ERR] Erro na migracao:', err.message);
    process.exit(1);
  }
}

migrate();
