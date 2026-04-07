import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function main() {
  console.log(`[SMTP_TEST] Tentando logar com: ${process.env.SMTP_USER}`);
  try {
    const info = await transporter.sendMail({
      from: `"Playground AI" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // sends to itself to avoid spamming
      subject: 'Teste de SMTP - Playground AI',
      text: 'Se voce esta lendo isto, o SMTP esta funcionando!'
    });
    console.log('[SMTP_TEST] Success! Email enviado. ID:', info.messageId);
  } catch (error) {
    console.error('[SMTP_TEST] Faill! Ocorreu um erro:', error.message);
  }
  process.exit();
}

main();
