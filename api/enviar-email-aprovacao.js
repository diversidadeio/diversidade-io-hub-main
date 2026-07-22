import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const { email, nome } = req.body;
    if (!email) {
      return res.status(400).json({ erro: "E-mail não fornecido." });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.warn("AVISO: RESEND_API_KEY não configurada. E-mail de aprovação simulado.");
      return res.json({ sucesso: true, mensagem: "E-mail simulado." });
    }

    const nomeEmpresa = nome || "empresa";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #7030A0; font-size: 28px; margin: 0;">Diversidade.io</h1>
        </div>

        <div style="background: #f9f5ff; border-radius: 12px; padding: 32px; border: 1px solid #e9d5ff;">
          <h2 style="color: #1f2937; margin-top: 0;">🎉 Cadastro Aprovado!</h2>
          <p style="color: #374151; line-height: 1.6;">
            Olá, <strong>${nomeEmpresa}</strong>!
          </p>
          <p style="color: #374151; line-height: 1.6;">
            Temos ótimas notícias! A nossa equipe analisou o seu cadastro e ele foi
            <strong>aprovado com sucesso</strong>.
          </p>
          <p style="color: #374151; line-height: 1.6;">
            Agora você tem acesso completo à plataforma Diversidade.io, incluindo pesquisas,
            gerenciamento de usuários e todas as funcionalidades disponíveis para o seu perfil.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a
              href="https://www.diversidade.io/login"
              style="background: #7030A0; color: white; padding: 14px 32px; border-radius: 8px;
                     text-decoration: none; font-weight: bold; font-size: 16px;"
            >
              Acessar a Plataforma
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            Se tiver alguma dúvida, entre em contato pelo WhatsApp:
            <a href="https://wa.me/5511989832953" style="color: #7030A0;">+55 (11) 98983-2953</a>
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          © 2025 Diversidade.io — Todos os direitos reservados.
        </p>
      </div>
    `;

    const resend = new Resend(RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: "Diversidade.io <nao-responder@diversidade.io>",
      to: email,
      subject: "✅ Seu cadastro foi aprovado! — Diversidade.io",
      html: htmlBody,
    });

    if (emailError) {
      console.error("Erro ao enviar e-mail de aprovação:", emailError);
      return res.status(500).json({ erro: "Erro ao enviar e-mail de aprovação." });
    }

    return res.json({ sucesso: true, mensagem: "E-mail de aprovação enviado com sucesso." });
  } catch (err) {
    console.error("Erro no endpoint /api/enviar-email-aprovacao:", err);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}
