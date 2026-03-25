import { ImageEditEngine } from '../services/engines/image-edit.engine.js';

export const editImage = async (req, res) => {
  try {
    const { prompt: userPrompt } = req.body;
    const files = req.files;

    if (!userPrompt) throw new Error('Prompt não enviado.');
    if (!files || files.length === 0) throw new Error('Imagem não enviada.');

    const imageFile = files.find(f => f.fieldname === 'image');
    const maskFile = files.find(f => f.fieldname === 'mask');

    if (!imageFile) throw new Error('Imagem base ausente.');

    // Orquestração via Engine Level 3
    const result = await ImageEditEngine.execute(req.user.id, {
      userPrompt,
      imageBuffer: imageFile.buffer,
      maskBuffer: maskFile?.buffer
    });

    res.json(result);
  } catch (err) {
    console.error(`[CONTROLLER_EDIT_ERR]`, err.message);
    
    const statusCode = err.message.includes('Saldo insuficiente') ? 403 : 500;
    res.status(statusCode).json({ 
      success: false, 
      error: err.message 
    });
  }
};
