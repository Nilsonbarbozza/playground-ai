import express from 'express';
import { generateImage } from '../controllers/generateController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Text-to-Image Generation
// Uses upload.none() because we only expect text prompt in the body
router.post('/', authMiddleware, upload.none(), generateImage);

export default router;
