import express from 'express';
import { ingestTelemetryEvents } from '../controllers/telemetryController.js';
import {
  getTelemetryDashboardCredits,
  getTelemetryDashboardInteractions,
  getTelemetryDashboardInsights,
  getTelemetryDashboardOps,
  getTelemetryDashboardSummary
} from '../controllers/telemetryDashboardController.js';
import { adminMiddleware } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.post('/events', ingestTelemetryEvents);
router.get('/dashboard/summary', adminMiddleware, getTelemetryDashboardSummary);
router.get('/dashboard/ops', adminMiddleware, getTelemetryDashboardOps);
router.get('/dashboard/interactions', adminMiddleware, getTelemetryDashboardInteractions);
router.get('/dashboard/credits', adminMiddleware, getTelemetryDashboardCredits);
router.get('/dashboard/insights', adminMiddleware, getTelemetryDashboardInsights);

export default router;
