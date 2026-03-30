import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { upscaleImage } from '../controllers/upscaleController.js';

const router = express.Router();

router.post('/', authMiddleware, upload.any(), upscaleImage);

export default router;

