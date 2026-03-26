import express from 'express';
import { submitVideoJob, checkVideoStatus, syncVideoStatus } from '../controllers/videoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/generate', upload.any(), submitVideoJob);
router.get('/status/:id', checkVideoStatus);
router.post('/status/:id/sync', syncVideoStatus);

export default router;
