import express from 'express';
import { processFaceSwap } from '../controllers/faceswapController.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/generate', upload.any(), processFaceSwap);

export default router;
