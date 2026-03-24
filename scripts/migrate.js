require('dotenv').config();
const { pool } = require('../config/db');

const createTables = async () => {
  const queryText = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      credits INT DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      prompt TEXT,
      image_url VARCHAR(255) NOT NULL,
      module VARCHAR(50) DEFAULT 'image_editor',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credits_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount_deducted INT DEFAULT 1,
      action VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('🔄 Criando tabelas no PostgreSQL...');
    await pool.query(queryText);
    console.log('✅ Tabelas criadas com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao criar tabelas:', err);
    process.exit(1);
  }
};

createTables();
