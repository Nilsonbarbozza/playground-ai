import dotenv from 'dotenv';
import db from './config/db.js';

dotenv.config();

async function migrate() {
  console.log('--- Migração Level 3 (Billing) ---');
  
  try {
    // 1. Criar tabela de Ledger
    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabela credit_ledger criada/verificada.');

    // 2. Garantir que a coluna credits existe na users (já existe, mas check)
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0`);
    
    console.log('🚀 Migração concluída com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  }
}

migrate();
