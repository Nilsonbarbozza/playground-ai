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
async function normalizeMask(buffer, intent = 'EDIT') {
  let sharpInstance = sharp(buffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0 }
    })
    .grayscale();

  if (intent === 'ERASE') {
    // APLICA DILATAÇÃO (GROW MASK) LEVE PARA EVITAR COLOR BLEED EM REMOÇÕES completas
    // O blur(5) com threshold(50) garante um inchaço sutil (approx 3-5px) para matar a bordinha da roupa sem destruir a iluminação do resto do objeto (ex: boné).
    sharpInstance = sharpInstance.blur(5).threshold(50);
  } else {
    // Para EDIÇÃO/INPAINT (ex: pintar roupa): Máscara exata para não destruir destalhes (rosto, cabelo)
    sharpInstance = sharpInstance.threshold(128);
  }

  return await sharpInstance.png().toBuffer();
}

// =========================
// Health
// =========================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==========================================
// 3. ROTA PRINCIPAL DA API (Apenas processamento lógico)
// ==========================================
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
    // Preparação de Imagem para Visão Computacional
    // =========================
    const baseImage = await normalizeImage(imageFile.buffer);
    const inputImageBase64 = `data:image/png;base64,${baseImage.toString('base64')}`;

    // =========================
    // Roteamento Semântico + Vision GPT
    // =========================
    console.log(`[${requestId}] Analisando intenção, arte e iluminação via GPT-4o-mini Vision...`);
    
    let intent = "EDIT"; // Padrão
    let finalPromptText = userPrompt;
    let negativePromptText = "low quality, blur, distortion, bad anatomy, artifacts";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Art Director and Computer Vision Architect for a Surgical Inpainting API (Stability AI).
Your mission is to perform a surgical dissection of the user's image and instruction, outputting a hyper-precise JSON parameters object.

STRICT VISUAL ANALYSIS:
1. ART STYLE & TEXTURE: Identify exact materials present (e.g., 'rough cotton', 'brushed metal', 'flat 2D vector graphic', 'smooth photorealistic'). 
2. EXACT COLORS: Identify exact colors requested. If the user requests a specific HEX color (e.g. #777772) or literal hue, you MUST command the engine to use that exact color shade contextually on the object.
3. BACKGROUND PRESERVATION: The background outside the mask MUST NOT change. 

JSON RESPONSE FORMAT:
{
  "intent": "ERASE" or "EDIT",
  "texture_analysis": "<internal text describing the physical materials of the image>",
  "lighting_background_analysis": "<internal text describing the ambiance, lighting, and background type>",
  "prompt": "<If EDIT: highly descriptive prompt combining the requested object, the exact color, the physical texture, the lighting, and the art style. DO NOT mention the whole image context like 'a room' or 'a man'. ONLY describe the targeted object inside the mask. Respond in English.>",
  "negative_prompt": "<CRITICAL: Exhaustive list of what to BLOCK. If the art is 2D, block '3d, photorealistic, cinematic'. ALWAYS block 'text, logos, signatures, watermarks, background alteration, mismatched environment'. Ensure the background stays pristine.>"
}
`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `User Edit Instruction: ${userPrompt}` },
              { type: "image_url", image_url: { url: inputImageBase64, detail: "low" } }
            ]
          }
        ]
      });

      const enhanced = JSON.parse(completion.choices[0].message.content);
      intent = enhanced.intent === "ERASE" ? "ERASE" : "EDIT";
      if (enhanced.prompt) finalPromptText = enhanced.prompt;
      if (enhanced.negative_prompt) negativePromptText = enhanced.negative_prompt;
      
      console.log(`[${requestId}] Resultado GPT -> Intenção: ${intent} | Prompt Estendido:`, finalPromptText);
    } catch (openaiErr) {
      console.warn(`[${requestId}] Erro no roteador GPT-4o-mini Vision, assumindo EDIT:`, openaiErr.message);
    }

    // =========================
    // Processamento da Máscara (Baseado na Intenção)
    // =========================
    let maskImage = null;
    if (maskFile) {
      console.log(`[${requestId}] Máscara detectada, normalizando para o modo: ${intent}`);
      maskImage = await normalizeMask(maskFile.buffer, intent);
    }

    // =========================
    // Chamada para a API da Stability AI
    // =========================
    const STABILITY_KEY = process.env.STABILITY_API_KEY;
    if (!STABILITY_KEY) {
      throw new Error("STABILITY_API_KEY não configurada no .env.");
    }

    const endpointUrl = intent === 'ERASE' 
      ? 'https://api.stability.ai/v2beta/stable-image/edit/erase'
      : 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';

    console.log(`[${requestId}] Disparando requisição real para o endpoint: ${endpointUrl}`);

    const formData = new FormData();
    formData.append('image', baseImage, { filename: 'image.png', contentType: 'image/png' });
    
    if (maskImage) {
      formData.append('mask', maskImage, { filename: 'mask.png', contentType: 'image/png' });
    }

    // Stability Erase ignora prompts. Inpaint requer.
    if (intent === 'EDIT') {
      formData.append('prompt', finalPromptText);
      formData.append('negative_prompt', negativePromptText);
    }
    
    formData.append('seed', 0);
    formData.append('output_format', 'png');

    const response = await axios.post(
      endpointUrl,
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