import express from 'express';
import multer from 'multer';
import { submitVideoJob, checkVideoStatus } from '../controllers/videoController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(authMiddleware);

router.post('/generate', upload.any(), submitVideoJob);
router.get('/status/:id', checkVideoStatus);

export default router;
