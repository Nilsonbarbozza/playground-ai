import jwt from 'jsonwebtoken';
import { UsersRepository } from '../repositories/users.repository.js';

function parseCsv(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAdminByConfig(user) {
  const adminIds = parseCsv(process.env.ADMIN_USER_IDS);
  const adminEmails = parseCsv(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase());
  const userEmail = String(user.email || '').toLowerCase();

  if (adminIds.includes(user.id)) return true;
  if (adminEmails.includes(userEmail)) return true;
  return false;
}

export const adminMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token nao fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UsersRepository.findProfileById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Usuario invalido.' });
    }

    if (!isAdminByConfig(user)) {
      return res.status(403).json({ error: 'Acesso restrito para administradores.' });
    }

    req.user = { id: user.id, email: user.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'Token invalido.' });
  }
};
