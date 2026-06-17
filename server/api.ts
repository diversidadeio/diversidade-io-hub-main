import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const apiRouter = Router();

// Certifique-se de que o servidor tenha acesso às variáveis de ambiente
// Em produção elas estarão no processo, no desenvolvimento o Vite carrega do .env
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

// Supabase client (apenas para chamar a RPC)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

apiRouter.post("/recuperar-senha", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ erro: "E-mail é obrigatório." });
    }

    // 1. Chama a RPC para gerar a senha temporária
    const { data: novaSenha, error } = await supabase.rpc("solicitar_recuperacao_senha", {
      p_email: email,
    });

    if (error) {
      console.error("Erro na RPC solicitar_recuperacao_senha:", error);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    if (!novaSenha) {
      return res.status(404).json({ erro: "Este e-mail não está cadastrado em nosso sistema." });
    }

    // 2. Enviar o e-mail via SMTP (Office 365)
    const SMTP_HOST = process.env.SMTP_HOST || "smtp.office365.com";
    const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_USER || !SMTP_PASS) {
      console.warn("AVISO: Credenciais SMTP não configuradas. O e-mail não será enviado de verdade.");
      console.log(`[E-mail Simulado] Para: ${email} | Nova Senha: ${novaSenha}`);
      return res.json({ sucesso: true, mensagem: "E-mail simulado (verifique o console do servidor)." });
    }

    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <!-- Substitua por uma URL absoluta da sua logo hospedada, se necessário -->
          <h1 style="color: #7030A0; margin: 0;">Diversidade.io</h1>
        </div>
        <h2 style="color: #111827; font-size: 20px;">Recuperação de Senha</h2>
        <p style="color: #4b5563; line-height: 1.5;">
          Olá! Recebemos uma solicitação para recuperar o acesso à sua conta na <strong>Diversidade.io</strong>.
        </p>
        <p style="color: #4b5563; line-height: 1.5;">
          Sua nova senha de acesso temporária é:
        </p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
          <strong style="font-size: 24px; color: #7030A0; letter-spacing: 2px;">${novaSenha}</strong>
        </div>
        <p style="color: #4b5563; line-height: 1.5;">
          Por motivos de segurança, recomendamos que você altere essa senha assim que fizer o login no sistema.
        </p>
        <p style="color: #4b5563; line-height: 1.5; margin-top: 30px;">
          Atenciosamente,<br>
          <strong>Equipe Diversidade.io</strong>
        </p>
      </div>
    `;

    // Configura o transporter do nodemailer
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // false para 587
      requireTLS: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
    });

    try {
      await transporter.sendMail({
        from: `"Diversidade.io" <${SMTP_USER}>`,
        to: email,
        subject: "Recuperação de Senha - Diversidade.io",
        html: htmlEmail,
      });

      res.json({ sucesso: true, mensagem: "E-mail enviado com sucesso." });
    } catch (emailErr: any) {
      console.error("Erro ao enviar e-mail via SMTP:", emailErr);
      return res.status(500).json({ erro: "Erro Microsoft: " + (emailErr.message || emailErr.response || "Falha na autenticação.") });
    }
  } catch (err) {
    console.error("Erro no endpoint /recuperar-senha:", err);
    res.status(500).json({ erro: "Erro interno do servidor." });
  }
});
