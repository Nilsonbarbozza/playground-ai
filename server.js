import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Global crash protection
process.on('uncaughtException', (err) => console.error('[CRASH] Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('[CRASH] Unhandled:', reason));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Multer Memory Storage (As per agent.md - preventing disk usage)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Health Check / Diagnostic
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * Main AI Image Edit Route
 */
app.get('/api/edit', (req, res) => {
  res.send('Este é um endpoint de POST. Por favor, use o botão "Editar com IA" na página inicial.');
});

app.post('/api/edit', upload.single('image'), async (req, res) => {
  console.log(`\n--- NEW REQUEST: ${new Date().toLocaleTimeString()} ---`);
  
  try {
    const { prompt } = req.body;
    const file = req.file;

    if (!file || !prompt) {
      throw new Error('Faltando imagem ou comando (prompt).');
    }

    console.log(`[Flow] 1. Processing image: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Ensure 1024x1024 PNG with transparency from memory buffer
    const processedBuffer = await sharp(file.buffer)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .ensureAlpha()
      .png()
      .toBuffer();

    console.log('[Flow] 2. Sending to OpenAI (DALL-E 2 Edit) via Axios...');
    
    const form = new FormData();
    form.append('image', processedBuffer, { filename: 'image.png', contentType: 'image/png' });
    form.append('prompt', prompt);
    form.append('model', 'dall-e-2');
    form.append('n', 1);
    form.append('size', '1024x1024');

    const response = await axios.post('https://api.openai.com/v1/images/edits', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    const resultUrl = response.data.data[0].url;
    console.log('[Flow] 3. Success!');

    res.json({ url: resultUrl });

  } catch (err) {
    console.error('[Error Details]', err.response?.data || err.message);
    
    let clientMsg = 'Erro ao processar imagem na OpenAI.';
    let details = err.message;

    if (details.includes('transparency')) {
      clientMsg = 'A OpenAI exige que a imagem tenha áreas transparentes para editar.';
      details = 'Dica: Tente carregar um PNG com fundo transparente ou uma imagem retangular.';
    }

    res.status(500).json({ error: clientMsg, details: details });
  }
});

function safeDelete(p) {
  if (p && fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

app.listen(PORT, () => {
  console.log(`\n🚀 [AI EDITOR SERVER] Online: http://localhost:${PORT}`);
});
