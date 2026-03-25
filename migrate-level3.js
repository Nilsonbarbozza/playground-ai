import dotenv from 'dotenv';
dotenv.config();

// Dynamic import AFTER dotenv loads, so DATABASE_URL is available
const db = (await import('./config/db.js')).default;

async function migrate() {
  console.log('--- Migração Level 3 (Full Schema) ---');
  console.log(`📡 Conectando a: ${process.env.DATABASE_URL?.substring(0, 40)}...`);
  
  try {
    // 1. Extensão UUID
    await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('✅ Extensão uuid-ossp verificada.');

    // 2. Tabela de Usuários
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        credits INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela users criada/verificada.');

    // 3. Tabela de Projetos
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
    console.log('✅ Tabela projects criada/verificada.');

    // 4. Tabela de Ledger de Créditos
    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabela credit_ledger criada/verificada.');

    console.log('\n🚀 Migração concluída com sucesso! Banco pronto.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  }
}

migrate();
