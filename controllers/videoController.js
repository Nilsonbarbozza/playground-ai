import { VideoEngine } from '../services/engines/video.engine.js';

export const submitVideoJob = async (req, res) => {
  try {
    const files = req.files;
    const imageFile = files?.find(f => f.fieldname === 'image');
    if (!imageFile) throw new Error('Imagem base ausente.');
    const prompt = req.body?.prompt || null;
    const cfg_scale = req.body?.cfg_scale;
    const motion_bucket_id = req.body?.motion_bucket_id;
    const seed = req.body?.seed;
    const profile = req.body?.profile;

    const result = await VideoEngine.submit(req.user.id, {
      imageBuffer: imageFile.buffer,
      prompt,
      cfg_scale,
      motion_bucket_id,
      seed,
      profile
    });

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
    const result = await VideoEngine.getStatus(req.user.id, id);

    if (result.status === 'queued' || result.status === 'processing') {
      return res.status(202).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[CONTROLLER_VIDEO_STATUS_ERR]', err.message);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

export const syncVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await VideoEngine.syncStatus(req.user.id, id);

    if (result.status === 'queued' || result.status === 'processing') {
      return res.status(202).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[CONTROLLER_VIDEO_SYNC_ERR]', err.message);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};
