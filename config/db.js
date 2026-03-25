import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

function getPool() {
  if (!pool) {
    const isRemote = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isRemote ? { rejectUnauthorized: false } : false
    });
    console.log(`[DB] Pool criado → ${process.env.DATABASE_URL?.substring(0, 45)}...`);
  }
  return pool;
}

export default {
  query: (text, params) => getPool().query(text, params),
  get pool() { return getPool(); }
};
