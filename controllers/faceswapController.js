import axios from 'axios';
import db from '../config/db.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const processFaceSwap = async (req, res) => {
  try {
    // [SAAS] Verifica Créditos (Face Swap custa 2)
    const userCheck = await db.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].credits < 2) {
      return res.status(403).json({ error: 'Saldo insuficiente. Face Swap custa 2 créditos.' });
    }

    const files = req.files;
    if (!files || files.length < 2) {
      throw new Error('Você deve enviar duas imagens: target_image e swap_image.');
    }

    const targetImg = files.find(f => f.fieldname === 'target_image');
    const swapImg = files.find(f => f.fieldname === 'swap_image');

    if (!targetImg || !swapImg) {
      throw new Error('Faltando target_image ou swap_image.');
    }

    const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
    if (!REPLICATE_KEY) {
      // Mock Mode Se não tiver Key
      throw new Error('REPLICATE_API_KEY não configurada no .env');
    }

    // Converte Buffers em DataURI Base64 para envio
    const targetBase64 = `data:${targetImg.mimetype};base64,${targetImg.buffer.toString('base64')}`;
    const swapBase64 = `data:${swapImg.mimetype};base64,${swapImg.buffer.toString('base64')}`;

    // Passo 1: Iniciar predição no Replicate (Modelo lucataco/faceswap)
    const modelVersion = "9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d";
    const initRes = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: modelVersion,
        input: {
          target_image: targetBase64,
          swap_image: swapBase64
        }
      },
      {
        headers: {
          Authorization: `Token ${REPLICATE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let predictionUrl = initRes.data.urls.get;
    let predictionStatus = initRes.data.status;
    let outputUrl = null;

    // Passo 2: Inline Polling (Replicate demora ~5-10s para FaceSwap)
    let attempts = 0;
    while (predictionStatus !== 'succeeded' && predictionStatus !== 'failed' && attempts < 20) {
      await new Promise(r => setTimeout(r, 2000)); // Espera 2s
      attempts++;

      const checkRes = await axios.get(predictionUrl, {
        headers: { Authorization: `Token ${REPLICATE_KEY}` }
      });
      
      predictionStatus = checkRes.data.status;
      if (predictionStatus === 'succeeded') {
        // Replicate retorna um link para a img gerada no output (pode ser array dependendo do modelo)
        outputUrl = Array.isArray(checkRes.data.output) ? checkRes.data.output[0] : checkRes.data.output;
      } else if (predictionStatus === 'failed') {
        throw new Error('Falha no processamento do modelo Replicate.');
      }
    }

    if (!outputUrl) {
      throw new Error('Tempo limite excedido ao processar Face Swap.');
    }

    // Baixar a imagem retornada pela nuvem para persistir no nosso file system
    const imgRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
    const filename = `faceswap_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
    const publicDir = path.join(__dirname, '..', 'public', 'uploads');
    const filepath = path.join(publicDir, filename);
    
    await fsPromises.writeFile(filepath, imgRes.data);
    const finalImageUrl = `/uploads/${filename}`;

    // [SAAS] Deduz 2 créditos e registra
    await db.query('UPDATE users SET credits = credits - 2 WHERE id = $1', [req.user.id]);
    await db.query(
      'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'Troca de Rosto Automatizada', finalImageUrl, 'face-swap']
    );

    res.json({ success: true, url: finalImageUrl });
  } catch (err) {
    console.error('[FaceSwap Error]', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.response?.data?.detail || err.message });
  }
};
