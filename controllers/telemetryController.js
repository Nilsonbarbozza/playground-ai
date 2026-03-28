import jwt from 'jsonwebtoken';
import { TelemetryService } from '../services/telemetry/telemetry.service.js';

function extractUserId(req) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id || null;
  } catch {
    return null;
  }
}

export const ingestTelemetryEvents = async (req, res) => {
  try {
    const userId = extractUserId(req);
    const result = await TelemetryService.ingest({
      body: req.body,
      userId
    });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    console.error('[TELEMETRY_INGEST_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
