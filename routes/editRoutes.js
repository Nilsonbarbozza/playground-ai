import express from 'express';
import { editImage } from '../controllers/editController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Image Editor (Inpaint / Erase)
// Uses upload.any() to handle image and optional mask
router.post('/', authMiddleware, upload.any(), editImage);

export default router;
