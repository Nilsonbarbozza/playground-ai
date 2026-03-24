import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// Importante: No ES Modules, usar extensão .js mesmo para arquivos locais
import db from '../config/db.js';

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Usuário já cadastrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, credits',
      [email, passwordHash]
    );

    const user = result.rows[0];

    // Create token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: user.id, email: user.email, credits: user.credits } });
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({ error: 'Erro interno no servidor ao registrar usuário.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Fetch user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Compare passwords
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Create token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ token, user: { id: user.id, email: user.email, credits: user.credits } });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ error: 'Erro interno no servidor ao fazer login.' });
  }
};
