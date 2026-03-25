import { FaceSwapEngine } from '../services/engines/faceswap.engine.js';

export const processFaceSwap = async (req, res) => {
  try {
    const files = req.files;
    const targetImg = files?.find(f => f.fieldname === 'target_image');
    const swapImg = files?.find(f => f.fieldname === 'swap_image');

    if (!targetImg || !swapImg) {
      throw new Error('Você deve enviar target_image e swap_image.');
    }

    // Convert to DataURI for Engine (Matches Provider expectation)
    const targetBase64 = `data:${targetImg.mimetype};base64,${targetImg.buffer.toString('base64')}`;
    const swapBase64 = `data:${swapImg.mimetype};base64,${swapImg.buffer.toString('base64')}`;

    console.log('[FaceSwap Controller] Delegating to Engine...');
    const result = await FaceSwapEngine.execute(req.user.id, targetBase64, swapBase64);

    res.json(result);
  } catch (err) {
    console.error('[CONTROLLER_FACESWAP_ERR]', err.message);
    const statusCode = err.message.includes('Saldo insuficiente') ? 403 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};
