import { ImageEditEngine } from '../services/engines/image-edit.engine.js';
import sharp from 'sharp';

async function hasMaskPixels(maskBuffer) {
  if (!maskBuffer) return false;
  const alpha = await sharp(maskBuffer)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer();
  for (let i = 0; i < alpha.length; i += 1) {
    if (alpha[i] > 0) return true;
  }
  return false;
}

export const editImage = async (req, res) => {
  try {
    const { prompt: userPrompt, seed, output_format } = req.body;
    const files = req.files;

    if (!userPrompt) throw new Error('Prompt não enviado.');
    if (!files || files.length === 0) throw new Error('Imagem não enviada.');

    const imageFile = files.find(f => f.fieldname === 'image');
    const maskFile = files.find(f => f.fieldname === 'mask');

    if (!imageFile) throw new Error('Imagem base ausente.');
    if (!maskFile) throw new Error('Mascara ausente. Pinte a area antes de gerar.');
    const maskHasPixels = await hasMaskPixels(maskFile.buffer);
    if (!maskHasPixels) throw new Error('Mascara vazia. Pinte a area antes de gerar.');

    // Orquestração via Engine Level 3
    const result = await ImageEditEngine.execute(req.user.id, {
      userPrompt,
      imageBuffer: imageFile.buffer,
      maskBuffer: maskFile.buffer,
      seed,
      output_format
    });

    res.json(result);
  } catch (err) {
    console.error(`[CONTROLLER_EDIT_ERR]`, err.message);
    
    const statusCode = err.message.includes('Saldo insuficiente')
      ? 403
      : err.message.toLowerCase().includes('mascara') || err.message.toLowerCase().includes('prompt')
      ? 400
      : 500;
    res.status(statusCode).json({ 
      success: false, 
      error: err.message 
    });
  }
};
