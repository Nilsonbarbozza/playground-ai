import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import faceswapRoutes from './routes/faceswapRoutes.js';
import generateRoutes from './routes/generateRoutes.js';
import editRoutes from './routes/editRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import { stripeWebhook } from './controllers/billingController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Stripe requires the raw body for signature validation.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/faceswap', faceswapRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/edit', editRoutes);
app.use('/api/billing', billingRoutes);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: `Rota de API nao encontrada: ${req.method} ${req.url}` });
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[SERVER_ERR]', err.stack);
  if (req.url.startsWith('/api')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Erro interno no servidor'
    });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`AI Playground running at http://localhost:${PORT}`);
});

process.on('uncaughtException', (err) => console.error('[CRASH] Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('[CRASH] Unhandled:', reason));
