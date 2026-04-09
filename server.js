import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import faceswapRoutes from './routes/faceswapRoutes.js';
import generateRoutes from './routes/generateRoutes.js';
import editRoutes from './routes/editRoutes.js';
import upscaleRoutes from './routes/upscaleRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import experimentRoutes from './routes/experimentRoutes.js';
import { stripeWebhook } from './controllers/billingController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Restrict CORS to allowed origin
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

// Security: Rate Limiting
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 attempts
  message: { error: 'Muitas tentativas de login/registro. Tente em uma hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const telemetryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { error: 'Limite de eventos excedido.' }
});

// Stripe requires the raw body for signature validation.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/faceswap', faceswapRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/edit', editRoutes);
app.use('/api/upscale', upscaleRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/telemetry', telemetryLimiter, telemetryRoutes);
app.use('/api/admin/experiments', experimentRoutes);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin/telemetry', (req, res) => res.sendFile(path.join(__dirname, 'admin-telemetry.html')));
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
