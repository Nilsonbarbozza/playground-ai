import express from 'express';
import { getProfile, getProjects } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todas as rotas de usuário exigem JWT
router.use(authMiddleware);

router.get('/me', getProfile);
router.get('/projects', getProjects);

export default router;
