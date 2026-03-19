import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import sharp from 'sharp';
import OpenAI from 'openai';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// Middleware
// =========================
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// =========================
// Utils
// =========================

// 🔒 Prompt anti-alucinação (CRÍTICO)
function buildEditPrompt(userPrompt) {
  return `
Edit the image according to the instruction below.

STRICT RULES:
- Apply ONLY the requested change
- DO NOT modify anything outside the target area
- Preserve identity, lighting, texture and composition
- Keep everything else exactly the same

Instruction: ${userPrompt}
  `.trim();
}

// 🖼️ Normalização da imagem base
async function normalizeImage(buffer) {
  return await sharp(buffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 } // DALL-E 2 EXIGE que as bordas sejam opacas, nunca transparentes!
    })
    .png()
    .toBuffer();
}

// 🎯 Normalização da máscara
async function normalizeMask(buffer) {
  return await sharp(buffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0 }
    })
    .grayscale()
    .threshold(128) // força binário (evita bleed)
    .png()
    .toBuffer();
}

// =========================
// Health
// =========================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// =========================
// EDIT ENDPOINT
// =========================
app.post('/api/edit', upload.any(), async (req, res) => {

  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[${requestId}] NEW REQUEST`);

  try {
    const { prompt: userPrompt } = req.body;
    const files = req.files;

    if (!userPrompt) throw new Error('Prompt não enviado.');
    if (!files || files.length === 0) throw new Error('Imagem não enviada.');

    const imageFile = files.find(f => f.fieldname === 'image');
    const maskFile = files.find(f => f.fieldname === 'mask');

    if (!imageFile) throw new Error('Imagem base ausente.');

    console.log(`[${requestId}] Prompt original:`, userPrompt);

    // =========================
    // Processamento
    // =========================
    const baseImage = await normalizeImage(imageFile.buffer);

    let maskImage = null;
    if (maskFile) {
      console.log(`[${requestId}] Máscara detectada`);
      maskImage = await normalizeMask(maskFile.buffer);
    }

    // =========================
    // Stability AI Image Edit (Erase)
    // =========================
    console.log(`[${requestId}] Enviando para Stability AI (Erase)...`);

    const STABILITY_KEY = process.env.STABILITY_API_KEY;
    if (!STABILITY_KEY) {
      throw new Error("STABILITY_API_KEY não configurada no .env. Configure sua chave para usar a funcionalidade Erase.");
    }

    // Call OpenAI to enhance the user's prompt using gpt-4o-mini
    let finalPromptText = "remove the specified object, fill with natural background, realistic, seamless, no artifacts, consistent lighting";
    let negativePromptText = "person, face, human, arm, body parts, human silhouette, phantom limbs, distortion, bad reconstruction, car, vehicle, blur, incomplete shelves, empty voids, bad lighting, overlapping objects, faulty perspective, fuzzy labels, bad reconstruction, empty shelves";

    console.log(`[${requestId}] Melhorando prompt via OpenAI GPT-4o-mini...`);
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é um engenheiro de prompt especialista no modelo de inpainting/erase da Stability AI.
Sua missão é pegar a intenção do usuário (sobre o que ele quer no lugar ou o que remover) e transformá-la num prompt extremamente descritivo, otimizado para inpainting fotorrealista e orgânico.
Você também deve gerar um 'negative_prompt' robusto para evitar qualquer artefato ou traços da imagem original removida.
Obrigatoriamente, seu output deve ser apenas um JSON contendo:
{
  "prompt": "sua instrução aprimorada em ingles...",
  "negative_prompt": "seu prompt negativo aprimorado em ingles..."
}`
          },
          {
            role: "user",
            content: userPrompt || "Clean up this area perfectly."
          }
        ]
      });

      const enhanced = JSON.parse(completion.choices[0].message.content);
      if (enhanced.prompt) finalPromptText = enhanced.prompt;
      if (enhanced.negative_prompt) negativePromptText = enhanced.negative_prompt;
      console.log(`[${requestId}] Prompt Otimizado:`, enhanced);
    } catch (openaiErr) {
      console.warn(`[${requestId}] Erro no OpenAI GPT-4o-mini, usando default:`, openaiErr.message);
    }

    const formData = new FormData();
    formData.append('image', baseImage, { filename: 'image.png', contentType: 'image/png' });
    
    if (maskImage) {
      formData.append('mask', maskImage, { filename: 'mask.png', contentType: 'image/png' });
    }

    formData.append('prompt', finalPromptText);
    formData.append('negative_prompt', negativePromptText);
    formData.append('seed', 0);
    formData.append('output_format', 'png');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/edit/erase',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${STABILITY_KEY}`,
          Accept: "image/*"
        },
        responseType: 'arraybuffer', // Para receber os bytes brutos da imagem gerada
        validateStatus: undefined
      }
    );

    if (response.status !== 200) {
      throw new Error(`Erro da API Stability (${response.status}): ${response.data.toString()}`);
    }

    const outputImageBuffer = response.data;
    const imageBase64 = `data:image/png;base64,${Buffer.from(outputImageBuffer).toString('base64')}`;

    console.log(`[${requestId}] ✅ Sucesso`);

    res.json({
      success: true,
      url: imageBase64,
      image: imageBase64
    });

  } catch (err) {

    console.error(`[${requestId}] ❌ ERRO:`, err.message);

    let message = 'Erro ao editar imagem.';
    let details = err.message;

    if (details.includes('mask')) {
      message = 'Erro na máscara enviada.';
    }

    if (details.includes('image')) {
      message = 'Erro no processamento da imagem.';
    }

    res.status(500).json({
      success: false,
      error: message,
      details
    });
  }
});

// =========================
// OBRIGATÓRIO: Servir os arquivos do Frontend
// =========================
app.use(express.static(__dirname));

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`\n🚀 Server rodando em http://localhost:${PORT}`);
});