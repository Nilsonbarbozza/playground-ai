import { VideoEngine } from '../services/engines/video.engine.js';

export const submitVideoJob = async (req, res) => {
  try {
    const files = req.files;
    const imageFile = files?.find(f => f.fieldname === 'image');
    if (!imageFile) throw new Error('Imagem base ausente.');

    // Level 3: Submit via Engine
    const result = await VideoEngine.submit(req.user.id, imageFile.buffer);

    res.json(result);
  } catch (err) {
    console.error('[CONTROLLER_VIDEO_SUBMIT_ERR]', err.message);
    const statusCode = err.message.includes('Saldo insuficiente') ? 403 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
};

export const checkVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Level 3: Check and Persist via Engine (Ensures idempotency and no side-effects on GET)
    const result = await VideoEngine.checkAndPersist(req.user.id, id);

    if (result.status === 'in-progress') {
      return res.status(202).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[CONTROLLER_VIDEO_STATUS_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
