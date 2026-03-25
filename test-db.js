import db from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('Testando conexão...');
try {
  const res = await db.query('SELECT NOW()');
  console.log('Conexão OK:', res.rows[0]);
  process.exit(0);
} catch (err) {
  console.error('Falha na conexão:', err.message);
  process.exit(1);
}
