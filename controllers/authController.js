import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UsersRepository } from '../repositories/users.repository.js';

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha sao obrigatorios.' });
    }

    const userCheck = await UsersRepository.findIdByEmail(email);
    if (userCheck) {
      return res.status(400).json({ error: 'Usuario ja cadastrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await UsersRepository.create(email, passwordHash);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, credits: user.credits },
      is_first_signup: true
    });
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({ error: 'Erro interno no servidor ao registrar usuario.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UsersRepository.findAuthByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, credits: user.credits },
      is_first_signup: false
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ error: 'Erro interno no servidor ao fazer login.' });
  }
};
