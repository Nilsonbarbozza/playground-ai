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
 * 🖼️ Normalização da imagem base para 1024x1024
 */
export async function normalizeImage(buffer) {
  return await sharp(buffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 } 
    })
    .png()
    .toBuffer();
}

/**
 * 🎯 Normalização da máscara para 1024x1024
 */
export async function normalizeMask(buffer, intent = 'EDIT') {
  let sharpInstance = sharp(buffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0 }
    })
    .grayscale();

  if (intent === 'ERASE') {
    // APLICA DILATAÇÃO (GROW MASK) LEVE PARA EVITAR COLOR BLEED
    sharpInstance = sharpInstance.blur(5).threshold(50);
  } else {
    sharpInstance = sharpInstance.threshold(128);
  }

  return await sharpInstance.png().toBuffer();
}

/**
 * ✨ Color Seeding (Hinting)
 * Injects a color patch based on user mask to guide the AI
 */
export async function applyColorSeed(baseImageBuffer, maskBuffer, hexColor) {
  const colorBuffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
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
