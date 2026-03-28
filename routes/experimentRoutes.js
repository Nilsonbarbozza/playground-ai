import express from 'express';
import { getTopupModalConfig, updateTopupModalConfig } from '../controllers/experimentController.js';
import { adminMiddleware } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.use(adminMiddleware);
router.get('/topup-modal', getTopupModalConfig);
router.put('/topup-modal', updateTopupModalConfig);

export default router;
