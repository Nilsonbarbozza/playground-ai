import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load Environment Variables (MANDATORY LINE 1 per skills/agent.md)
dotenv.config();

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import faceswapRoutes from './routes/faceswapRoutes.js';
import generateRoutes from './routes/generateRoutes.js';
import editRoutes from './routes/editRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Middleware
// =========================
app.use(cors());
app.use(express.json());

// =========================
// Routes Registration
// =========================
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/faceswap', faceswapRoutes);
app.use('/api/generate', generateRoutes); // Simplified route for T2I
app.use('/api/edit', editRoutes);         // Simplified route for Inpaint/Erase

// =========================
// Static Assets & Frontend
// =========================

// Servir apenas o necessário (Princípio do Menor Privilégio)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Fallback para index.html (SPA) - Apenas para rotas que NÃO são de API e NÃO são arquivos estáticos
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.url}` });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Manipulador de Erros Global (Sempre JSON para /api)
app.use((err, req, res, next) => {
  console.error('[SERVER_ERR]', err.stack);
  if (req.url.startsWith('/api')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Erro interno no servidor'
    });
  }
  next(err);
});

// =========================
// Bootstrap
// =========================
app.listen(PORT, () => {
  console.log(`\n🚀 AI Playground Level 2 (Modular) running at http://localhost:${PORT}`);
});

// Crash Protection
process.on('uncaughtException', (err) => console.error('[CRASH] Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('[CRASH] Unhandled:', reason));