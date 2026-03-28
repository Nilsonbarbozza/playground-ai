import { TopupModalExperimentService } from '../services/experiments/topup-modal-experiment.service.js';

export const getTopupModalConfig = async (req, res) => {
  try {
    const config = await TopupModalExperimentService.getActiveConfig();
    res.json({ success: true, config });
  } catch (err) {
    console.error('[EXPERIMENT_GET_TOPUP_MODAL_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateTopupModalConfig = async (req, res) => {
  try {
    const updated = await TopupModalExperimentService.updateConfig({
      payload: req.body || {},
      adminUserId: req.user?.id || null
    });
    res.json({ success: true, ...updated });
  } catch (err) {
    console.error('[EXPERIMENT_UPDATE_TOPUP_MODAL_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
