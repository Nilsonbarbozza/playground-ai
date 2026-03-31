import { UpscaleEngine } from '../services/engines/upscale.engine.js';

export const upscaleImage = async (req, res) => {
  try {
    const files = req.files || [];
    const imageFile = files.find((f) => f.fieldname === 'image');
    if (!imageFile) throw new Error('Imagem nao enviada.');

    const {
      intent = 'both',
      factor = '2x',
      quality_profile = 'balanced',
      output_format = 'png',
      size_preset = '',
      width = '',
      height = '',
      fit = 'cover'
    } = req.body || {};

    const result = await UpscaleEngine.execute(req.user.id, {
      imageBuffer: imageFile.buffer,
      intent,
      factor,
      qualityProfile: quality_profile,
      outputFormat: output_format,
      sizePreset: size_preset,
      width,
      height,
      fit
    });

    res.json(result);
  } catch (err) {
    console.error('[CONTROLLER_UPSCALE_ERR]', err.message);
    const statusCode = err.message.includes('Saldo insuficiente') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: err.message
    });
  }
};
