import axios from 'axios';
import FormData from 'form-data';
import db from '../config/db.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const submitVideoJob = async (req, res) => {
  try {
    // [SAAS] Verifica Créditos (Video custa 5)
    const userCheck = await db.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].credits < 5) {
      return res.status(403).json({ error: 'Saldo insuficiente. Vídeos custam 5 créditos.' });
    }

    const files = req.files;
    if (!files || files.length === 0) throw new Error('Nenhuma imagem enviada para gerar vídeo.');

    const imageFile = files.find(f => f.fieldname === 'image');
    if (!imageFile) throw new Error('Imagem base ausente.');

    const STABILITY_KEY = process.env.STABILITY_API_KEY;
    const formData = new FormData();
    formData.append('image', imageFile.buffer, { filename: 'image.png', contentType: imageFile.mimetype });
    formData.append('seed', 0);
    formData.append('cfg_scale', 1.8);
    formData.append('motion_bucket_id', 127);

    const response = await axios.post(
      'https://api.stability.ai/v2beta/image-to-video',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${STABILITY_KEY}`
        },
        validateStatus: undefined
      }
    );

    if (response.status !== 200) {
      throw new Error(`Erro API Stability: ${JSON.stringify(response.data)}`);
    }

    res.json({
      success: true,
      generation_id: response.data.id,
      status: 'processing'
    });
  } catch (err) {
    console.error('[Vídeo Job Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const checkVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const STABILITY_KEY = process.env.STABILITY_API_KEY;

    const response = await axios.get(
      `https://api.stability.ai/v2beta/image-to-video/result/${id}`,
      {
        headers: {
          Authorization: `Bearer ${STABILITY_KEY}`,
          Accept: "video/*"
        },
        responseType: 'arraybuffer',
        validateStatus: undefined
      }
    );

    if (response.status === 202) {
      // 202 Accepted: Still processing
      return res.status(202).json({ status: 'in-progress' });
    }
    
    if (response.status !== 200) {
      throw new Error(`Erro ao verificar vídeo: status ${response.status}`);
    }

    // 200 OK: Finished -> Gravar ficheiro físico MP4
    const filename = `vid_${Date.now()}_${id}.mp4`;
    // Subimos dois nivels até a pasta public do projeto raiz
    const publicDir = path.join(__dirname, '..', 'public', 'uploads');
    const filepath = path.join(publicDir, filename);
    
    await fsPromises.writeFile(filepath, response.data);
    const videoUrl = `/uploads/${filename}`;

    // [SAAS] Deduz 5 créditos e registra log
    await db.query('UPDATE users SET credits = credits - 5 WHERE id = $1', [req.user.id]);
    await db.query(
      'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'Image-to-Video Animation', videoUrl, 'image-to-video']
    );

    res.json({ success: true, status: 'finished', url: videoUrl });
  } catch (err) {
    console.error('[Vídeo Polling Error]', err.message);
    res.status(500).json({ success: false, error: 'Falha durante o processamento do vídeo.' });
  }
};
