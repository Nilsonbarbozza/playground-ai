import { Text2ImgEngine } from '../services/engines/text2img.engine.js';

export const generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) throw new Error('Prompt não enviado.');

    // Delegamos TUDO para a Engine (Billing -> AI -> Storage -> DB)
    const result = await Text2ImgEngine.execute(req.user.id, prompt);

    res.json(result);
  } catch (err) {
    console.error(`[CONTROLLER_GEN_ERR]`, err.message);
    
    const statusCode = err.message.includes('Saldo insuficiente') ? 403 : 500;
    res.status(statusCode).json({ 
      success: false, 
      error: err.message 
    });
  }
};
