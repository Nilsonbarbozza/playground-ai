import nodemailer from 'nodemailer';

export class MailService {
  static getTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  static async _sendHtmlEmail(to, subject, htmlContent) {
    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"Playground AI" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: htmlContent
      });
      return true;
    } catch (error) {
      console.error('[MailService Error]', error.message);
      return false; // Safely fail so it doesn't crash the main pipeline
    }
  }

  static async sendVerificationEmail(email, otpCode) {
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; text-align: center;">
      <div style="max-w-md mx-auto background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: inline-block; max-width: 500px; width: 100%;">
        <h2 style="color: #111827; margin-top: 0;">Código de Segurança</h2>
        <p style="color: #4b5563; font-size: 16px;">Use o código abaixo para validar o seu acesso no Playground AI. Ele expira em 10 minutos.</p>
        <div style="background-color: #f3f4f6; margin: 24px 0; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 32px; letter-spacing: 4px; color: #4f46e5; font-weight: bold;">
          ${otpCode}
        </div>
        <p style="color: #9ca3af; font-size: 12px;">Se você não solicitou este código, ignore este e-mail.</p>
      </div>
    </div>`;

    return this._sendHtmlEmail(email, 'Playground AI - Código de Verificação', html);
  }

  static async sendWelcomeEmail(email) {
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; text-align: center;">
      <div style="max-w-md mx-auto background-color: #ffffff; padding: 40px 30px; border-radius: 12px; border-top: 4px solid #4f46e5; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: inline-block; max-width: 500px; width: 100%;">
        <h2 style="color: #111827; margin-top: 0;">Bem-vindo ao Playground AI 🎉</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Sua conta foi verificada com sucesso! Você acaba de receber seus primeiros <strong>10 Créditos Grátis</strong> para explorar todas as nossas ferramentas de IA conectadas ao poder de geração e edição moderna.</p>
        
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-top: 20px;">Você poderá usar para:</p>
        <ul style="text-align: left; color: #4b5563; font-size: 15px; display: inline-block; padding-left: 20px;">
          <li>Geração e Edição Avançada de Imagens</li>
          <li>Geração de Vídeos (Text to Video / Image to video)</li>
          <li>Avatares Virtuais e FaceSwap</li>
        </ul>
        
        <div style="margin-top: 30px;">
          <a href="${process.env.APP_BASE_URL || 'http://localhost:3000'}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Começar a Criar</a>
        </div>
      </div>
    </div>`;

    return this._sendHtmlEmail(email, 'Bem-vindo ao Playground AI 🎉', html);
  }

  static async sendCreditConfirmationEmail(email, credits, amountBrlCents) {
    const amountVal = (amountBrlCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; text-align: center;">
      <div style="max-w-md mx-auto background-color: #ffffff; padding: 40px 30px; border-radius: 12px; border-top: 4px solid #10b981; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); display: inline-block; max-width: 500px; width: 100%;">
        <div style="background-color: #d1fae5; color: #059669; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 28px;">✔️</div>
        <h2 style="color: #111827; margin-top: 0;">Pagamento Confirmado!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Obrigado por assinar! Foram creditados <strong>${credits} Créditos</strong> na sua carteira. Suas possibilidades criativas acabam de ser recarregadas.</p>
        
        <div style="background-color: #f3f4f6; margin: 24px 0; padding: 15px; border-radius: 8px; text-align: left; color: #374151; font-size: 14px;">
          <strong>Resumo do Pedido:</strong><br/>
          Pacote de ${credits} Créditos<br/>
          Total Pago: ${amountVal}
        </div>
        
        <div style="margin-top: 30px;">
          <a href="${process.env.APP_BASE_URL || 'http://localhost:3000'}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar o Playground</a>
        </div>
      </div>
    </div>`;

    return this._sendHtmlEmail(email, 'Seus Créditos Chegaram 🚀 - Playground AI', html);
  }
}
