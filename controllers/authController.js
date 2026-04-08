import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UsersRepository } from '../repositories/users.repository.js';
import { MailService } from '../services/mail/mail.service.js';

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
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

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await UsersRepository.saveOtp(user.id, otpCode, expiresAt);

    await MailService.sendVerificationEmail(email, otpCode);

    res.status(201).json({
      message: 'Usuário registrado. Verifique seu e-mail.',
      user: { id: user.id, email: user.email },
      requires_verification: true
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

    if (!user.is_verified) {
      // Re-send OTP if needed
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await UsersRepository.saveOtp(user.id, otpCode, expiresAt);
      
      await MailService.sendVerificationEmail(email, otpCode);

      return res.status(403).json({ 
        error: 'Conta não verificada. Enviamos um novo código para seu e-mail.',
        requires_verification: true,
        user: { id: user.id, email: user.email }
      });
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

export const verifyOtp = async (req, res) => {
  try {
    const { userId, otpCode } = req.body;

    if (!userId || !otpCode) {
      return res.status(400).json({ error: 'ID do usuário e código são obrigatórios.' });
    }

    const isValid = await UsersRepository.verifyOtp(userId, otpCode);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    const user = await UsersRepository.findProfileById(userId);
    
    // Dispara o e-mail de Boas Vindas
    await MailService.sendWelcomeEmail(user.email);
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Conta verificada com sucesso.',
      token,
      user: { id: user.id, email: user.email, credits: user.credits },
      is_first_signup: true
    });
  } catch (error) {
    console.error('[Verify OTP Error]', error);
    res.status(500).json({ error: 'Erro interno ao verificar código.' });
  }
};
