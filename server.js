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

import fs from 'fs';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import authRoutes from './routes/authRoutes.js';
import { authMiddleware } from './middlewares/authMiddleware.js';
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import faceswapRoutes from './routes/faceswapRoutes.js';
import db from './config/db.js';

dotenv.config();

// Global crash protection (CRITICAL for debugging Eixo 2)
process.on('uncaughtException', (err) => console.error('[CRASH] Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('[CRASH] Unhandled:', reason));

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

// =========================
// Rotas Públicas (Auth)
// =========================
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/faceswap', faceswapRoutes);

// ==========================================
// 3. ROTA PRINCIPAL DA API (Apenas processamento lógico)
// ==========================================
app.post('/api/generate', authMiddleware, upload.none(), async (req, res) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`\n[${requestId}] NEW GENERATION REQUEST`);

  try {
    // [SAAS] Verifica se tem créditos
    const userCheck = await db.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].credits <= 0) {
      return res.status(403).json({ error: 'Saldo insuficiente. Compre mais créditos.' });
    }

    const { prompt } = req.body;
    if (!prompt) throw new Error('Prompt não enviado.');

    console.log(`[${requestId}] Gerando imagem via Stability Core: "${prompt}"`);

    const STABILITY_KEY = process.env.STABILITY_API_KEY;
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', 'png');
    // formData.append('aspect_ratio', '1:1'); // opcional na v2beta

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${STABILITY_KEY}`,
          Accept: "image/*"
        },
        responseType: 'arraybuffer',
        validateStatus: undefined
      }
    );

    if (response.status !== 200) {
      throw new Error(`Erro API Stability: ${response.data.toString()}`);
    }

    // Salvar local 
    const filename = `gen_${Date.now()}_${requestId}.png`;
    const filepath = path.join(__dirname, 'public', 'uploads', filename);
    await fsPromises.writeFile(filepath, response.data);
    
    const imageUrl = `/uploads/${filename}`;

    // [SAAS] Deduzir crédito e registrar projeto
    await db.query('UPDATE users SET credits = credits - 1 WHERE id = $1', [req.user.id]);
    await db.query(
      'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4)',
      [req.user.id, prompt, imageUrl, 'text-to-image']
    );
    console.log(`[${requestId}] 💳 1 Crédito deduzido. Imagem salva em ${imageUrl}`);

    res.json({
      success: true,
      url: imageUrl
    });
  } catch (err) {
    console.error(`[${requestId}] ❌ ERRO:`, err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==========================================
// 4. ROTA DE EDIÇÃO (Módulo Atual)
// ==========================================
app.post('/api/edit', authMiddleware, upload.any(), async (req, res) => {

  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[${requestId}] NEW REQUEST`);

  try {
    // [SAAS] Verifica se tem créditos ANTES de processar imagem/IA
    const userCheck = await db.query('SELECT credits FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0].credits <= 0) {
      return res.status(403).json({ error: 'Saldo insuficiente. Compre mais créditos.' });
    }

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
    let enhanced = null; // DECLARAÇÃO FORA PARA EVITAR REFERENCE ERROR

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Art Director and Computer Vision Architect for a Surgical Inpainting API (Stability AI).
Your mission is to perform a surgical dissection of the user's image and instruction, outputting a hyper-precise JSON parameters object.

STRICT INTENT ROUTING (CRITICAL):
1. **ERASE**: If the user uses verbs like "remover", "apagar", "limpar", "delete", "erase", "remove", "blank", OR if the goal is to leave a surface empty/clean, set intent to "ERASE".
2. **EDIT**: Only if the user wants to change colors, add new objects, or replace one thing with another specific thing.

STRICT VISUAL ANALYSIS:
1. ART STYLE & TEXTURE: Identify materials (e.g., '2D vector', 'cotton', 'metal'). 
2. EXACT COLORS: Identify HEX codes (#XXXXXX).
3. BACKGROUND PRESERVATION: The background outside the mask MUST NOT change. 

JSON RESPONSE FORMAT:
{
  "intent": "ERASE" or "EDIT",
  "target_hex": "<Extracted HEX or null>",
  "target_color_name": "<Nearest color name in English, e.g. 'vibrant yellow'>",
  "texture_analysis": "<internal text>",
  "lighting_background_analysis": "<internal text>",
  "prompt": "<Generic fragmented description of the OBJECT ONLY. Use English.>",
  "negative_prompt": "<CRITICAL: Exhaustive block of text, logos, fonts, symbols, graphics.>"
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

      enhanced = JSON.parse(completion.choices[0].message.content);
      intent = enhanced.intent === "ERASE" ? "ERASE" : "EDIT";
      finalPromptText = enhanced.prompt || userPrompt;
      negativePromptText = enhanced.negative_prompt || negativePromptText;

      // 💉 REFORÇO DE PROMPT PROGRAMÁTICO (Eixo 2)
      // Se há uma cor alvo, nós não confiamos no GPT para repetir. O JS faz o serviço pesado.
      if (intent === 'EDIT' && enhanced.target_hex) {
        const colorName = enhanced.target_color_name || 'requested color';
        const colorRepetition = `${colorName}, ${colorName}, ${colorName}, ${colorName}, ${colorName}`;
        finalPromptText = `${finalPromptText}, ${colorRepetition}, solid plain surface, no graphics, no logo, match original style`;
        negativePromptText = `${negativePromptText}, logos, text, letters, symbols, fffc, embroidery, badge, emblem, brand`;
      }
      
      console.log(`\n[${requestId}] 🎨 Análise do Diretor de Arte:`);
      console.log(`   🔸 [INTENÇÃO]: ${intent}`);
      console.log(`   🔸 [HEX DETECTADO]: ${enhanced.target_hex || "Nenhum"}`);
      console.log(`   🔸 [TEXTURA DEDUZIDA]: ${enhanced.texture_analysis || "N/A"}`);
      console.log(`   🔸 [LUZ/BACKGROUND]: ${enhanced.lighting_background_analysis || "N/A"}`);
      console.log(`   👉 [PROMPT POSITIVO]: ${finalPromptText}`);
      console.log(`   🛡️ [BLINDAGEM (NEG_PROMPT)]: ${negativePromptText}\n`);
    } catch (openaiErr) {
      console.warn(`[${requestId}] Erro no roteador GPT-4o-mini Vision, assumindo EDIT:`, openaiErr.message);
    }

    // =========================
    // Processamento da Máscara e Injeção de Cor (Color Seeding)
    // =========================
    let maskImage = null;
    let finalBaseImage = baseImage;

    if (maskFile) {
      console.log(`[${requestId}] Máscara detectada, normalizando para o modo: ${intent}`);
      maskImage = await normalizeMask(maskFile.buffer, intent);

      // --- TÉCNICA: COLOR SEEDING (HINTING) ---
      // Se o GPT identificou um HEX desejado, pintamos um pequeno "ponto semente" 
      // no centro da máscara para guiar a Stability AI fisicamente.
      if (intent === 'EDIT' && enhanced?.target_hex && enhanced.target_hex.startsWith('#')) {
        console.log(`[${requestId}] 💉 Aplicando Color Seed: ${enhanced.target_hex}`);
        
        try {
          // Criamos um buffer de cor sólida do tamanho da imagem
          const colorBuffer = await sharp({
            create: {
              width: 1024,
              height: 1024,
              channels: 3,
              background: enhanced.target_hex
            }
          }).png().toBuffer();

          // Usamos a máscara do usuário para "recortar" essa cor
          // Técnica nuclear de Seeding: Preenchemos a máscara 100% com a cor
          // Mas aplicamos um leve blur na borda do "patch" para a IA fundir suavemente
          const maskProcessed = await sharp(maskImage)
            .ensureAlpha()
            .extractChannel(0)
            .toBuffer();

          const colorWithAlpha = await sharp(colorBuffer)
            .joinChannel(maskProcessed) 
            .png()
            .toBuffer();

          finalBaseImage = await sharp(baseImage)
            .composite([{ input: colorWithAlpha, blend: 'over' }])
            .png()
            .toBuffer();
          
          console.log(`[${requestId}] ✨ Injeção Cromática Nuclear aplicada.`);
        } catch (seedErr) {
          console.error(`[${requestId}] Falha ao aplicar Color Seed:`, seedErr.message);
        }
      }
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
    formData.append('image', finalBaseImage, { filename: 'image.png', contentType: 'image/png' });
    
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

    console.log(`[${requestId}] ✅ Sucesso da IA.`);

    // [SAAS] Deduzir crédito e registrar na galeria 'Meus Projetos'
    await db.query('UPDATE users SET credits = credits - 1 WHERE id = $1', [req.user.id]);
    await db.query(
      'INSERT INTO projects (user_id, prompt, image_url, module) VALUES ($1, $2, $3, $4)',
      [req.user.id, finalPromptText, 'storage-pending-url', 'image_editor']
    );
    console.log(`[${requestId}] 💳 1 Crédito deduzido. Projeto salvo.`);

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
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`\n🚀 Server rodando em http://localhost:${PORT}`);
});