import express from 'express';
import {
  createCheckoutSession,
  getCreditOrderStatus,
  getTopupModalExperimentConfig,
  listCreditPackages
} from '../controllers/billingController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/packages', listCreditPackages);
router.get('/topup-modal-config', getTopupModalExperimentConfig);
router.post('/checkout-session', createCheckoutSession);
router.get('/orders/:id', getCreditOrderStatus);

export default router;
