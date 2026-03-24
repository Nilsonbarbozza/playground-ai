import express from 'express';
import multer from 'multer';
import { processFaceSwap } from '../controllers/faceswapController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

router.post('/generate', upload.any(), processFaceSwap);

export default router;
