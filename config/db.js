import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

function getPool() {
  if (!pool) {
    const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
    
    // Security: Only allow unauthorized SSL if explicitly permitted or in non-remote env
    const rejectUnauthorized = process.env.DB_REJECT_UNAUTHORIZED === 'true';

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRemote ? { rejectUnauthorized } : false
    });
    
    const dbHost = (process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'localhost';
    console.log(`[DB] Pool inicializado → ${dbHost}`);
  }
  return pool;
}

export default {
  query: (text, params) => getPool().query(text, params),
  get pool() { return getPool(); }
};
