import { TelemetryDashboardService } from '../services/telemetry/telemetry-dashboard.service.js';

export const getTelemetryDashboardSummary = async (req, res) => {
  try {
    const summary = await TelemetryDashboardService.getSummary(req.query || {});
    res.json({ success: true, summary });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTelemetryDashboardOps = async (req, res) => {
  try {
    const ops = await TelemetryDashboardService.getOpsStatus(req.query || {});
    res.json({ success: true, ops });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_OPS_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTelemetryDashboardInteractions = async (req, res) => {
  try {
    const data = await TelemetryDashboardService.getRecentInteractions(req.query || {});
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_INTERACTIONS_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTelemetryDashboardCredits = async (req, res) => {
  try {
    const data = await TelemetryDashboardService.getCreditsDashboard(req.query || {});
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_CREDITS_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTelemetryDashboardInsights = async (req, res) => {
  try {
    const data = await TelemetryDashboardService.getInsights(req.query || {});
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_INSIGHTS_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTelemetryDashboardExperiment = async (req, res) => {
  try {
    const data = await TelemetryDashboardService.getTopupExperiment(req.query || {});
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_EXPERIMENT_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getTelemetryDashboardEditorPreview = async (req, res) => {
  try {
    const data = await TelemetryDashboardService.getEditorPreviewMetrics(req.query || {});
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[TELEMETRY_DASHBOARD_EDITOR_PREVIEW_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
