import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, nome } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "E-mail não fornecido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usa as mesmas configurações SMTP do Supabase Auth (e-mail de recuperação de senha)
    const smtpHost     = Deno.env.get("SMTP_HOST")     ?? "";
    const smtpPort     = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser     = Deno.env.get("SMTP_USER")     ?? "";
    const smtpPass     = Deno.env.get("SMTP_PASS")     ?? "";
    const smtpSender   = Deno.env.get("SMTP_SENDER_NAME") ?? "Diversidade.io";
    const smtpFrom     = Deno.env.get("SMTP_ADMIN_EMAIL") ?? smtpUser;

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
              href="https://hub.diversidade.io/login"
              style="background: #7030A0; color: white; padding: 14px 32px; border-radius: 8px;
                     text-decoration: none; font-weight: bold; font-size: 16px;"
            >
              Acessar a Plataforma
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            Se tiver alguma dúvida, entre em contato pelo WhatsApp:
            <a href="https://wa.me/5511966060828" style="color: #7030A0;">+55 (11) 96606-0828</a>
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          © 2025 Diversidade.io — Todos os direitos reservados.
        </p>
      </div>
    `;

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
    });

    await client.send({
      from: `${smtpSender} <${smtpFrom}>`,
      to: email,
      subject: "✅ Seu cadastro foi aprovado! — Diversidade.io",
      content: "Seu cadastro foi aprovado! Por favor, visualize este e-mail em um cliente que suporte HTML.",
      html: htmlBody,
    });

    await client.close();

    return new Response(
      JSON.stringify({ sucesso: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao enviar e-mail de aprovação:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
