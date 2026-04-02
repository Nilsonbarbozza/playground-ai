import sharp from 'sharp';

/**
 * 🔒 Prompt anti-alucinação (CRÍTICO)
 */
export function buildEditPrompt(userPrompt) {
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

/**
 * 🖼️ Normalização da imagem base preservando a proporção original (com limite de 4 Megapixels da API)
 */
export async function normalizeImage(buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  let { width, height } = metadata;
  const MAX_PIXELS = 4194304; // 4 Megapixels (limite API)
  
  let sharpInstance = image;
  if (width * height > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (width * height));
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
    sharpInstance = sharpInstance.resize(width, height);
  }

  // Preenche transparência nativa com branco para a IA (Stability/DALL-E)
  return await sharpInstance.flatten({ background: '#ffffff' }).png().toBuffer();
}

/**
 * 🎯 Normalização da máscara preservando proporções
 */
export async function normalizeMask(buffer, intent = 'EDIT') {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  let { width, height } = metadata;
  const MAX_PIXELS = 4194304;
  
  let sharpInstance = image;
  if (width * height > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (width * height));
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
    sharpInstance = sharpInstance.resize(width, height);
  }

  // Robustez: achata sobre preto e converte qualquer cor pintada em branco (mask)
  sharpInstance = sharpInstance.flatten({ background: '#000000' }).grayscale();

  if (intent === 'ERASE') {
    // Para remover objetos, borramos levemente a máscara para garantir transição suave
    sharpInstance = sharpInstance.blur(3).threshold(20);
  } else {
    // Para edição (inpaint), usamos uma máscara nítida mas segura
    sharpInstance = sharpInstance.threshold(20);
  }

  return await sharpInstance.toFormat('png').toBuffer();
}

/**
 * ✨ Color Seeding (Hinting)
 */
export async function applyColorSeed(baseImageBuffer, maskBuffer, hexColor) {
  const metadata = await sharp(baseImageBuffer).metadata();

  const colorBuffer = await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 3,
      background: hexColor
    }
  }).png().toBuffer();

  const maskProcessed = await sharp(maskBuffer)
    .ensureAlpha()
    .extractChannel(0)
    .toBuffer();

  const colorWithAlpha = await sharp(colorBuffer)
    .joinChannel(maskProcessed) 
    .png()
    .toBuffer();

  return await sharp(baseImageBuffer)
    .composite([{ input: colorWithAlpha, blend: 'over' }])
    .png()
    .toBuffer();
}
