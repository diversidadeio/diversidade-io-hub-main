import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const { empresaId, nome, email, papel, convidadoPorEmail } = req.body;

    if (!empresaId || !nome || !email || !papel) {
      return res.status(400).json({ erro: "Dados incompletos." });
    }

    // 1. Verificar se já existe na tabela empresa_usuarios
    let authUserId = null;

    const { data: userData } = await supabaseAdmin
      .from("empresa_usuarios")
      .select("auth_user_id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (userData?.auth_user_id) {
      authUserId = userData.auth_user_id;
    } else {
      // Fallback: busca no Auth
      const { data: authList, error: listError } =
        await supabaseAdmin.auth.admin.listUsers();
      if (!listError) {
        const usuarioExistente = authList.users.find((u) => u.email === email);
        if (usuarioExistente) {
          authUserId = usuarioExistente.id;
        }
      }
    }

    if (!authUserId) {
      // 2. Criar usuário no Supabase Auth (sem senha — usará link de acesso)
      const { data: novoAuth, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { nome },
        });

      if (createError || !novoAuth.user) {
        return res
          .status(500)
          .json({ erro: "Erro ao criar usuário: " + createError?.message });
      }
      authUserId = novoAuth.user.id;
    }

    // 3. Inserir ou atualizar na tabela empresa_usuarios
    const { error: dbError } = await supabaseAdmin
      .from("empresa_usuarios")
      .upsert(
        {
          auth_user_id: authUserId,
          empresa_id: empresaId,
          nome,
          email,
          papel,
          status: "pendente",
        },
        { onConflict: "auth_user_id,empresa_id" }
      );

    if (dbError) {
      return res
        .status(500)
        .json({ erro: "Erro ao salvar no banco: " + dbError.message });
    }

    // 4. Gerar link de recuperação para o usuário definir a senha
    // O redirect_to deve apontar para /trocar-senha do app.
    // Usamos o origin do request para funcionar tanto em localhost quanto em produção.
    const origin = req.body.origin || "https://www.diversidade.io";
    const redirectToUrl = `${origin}/trocar-senha`;

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirectToUrl,
      },
    });
    
    const linkAcesso = linkData?.properties?.action_link || redirectToUrl;

    // 5. Enviar e-mail via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.warn("[Convite Simulado]", { email, linkAcesso });
      return res.json({
        sucesso: true,
        mensagem: "Convite simulado (RESEND_API_KEY não configurada).",
      });
    }

    const htmlConvite = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #7030A0; margin: 0;">Diversidade.io</h1>
        </div>
        <h2 style="color: #111827; font-size: 20px;">Você foi convidado(a)!</h2>
        <p style="color: #4b5563; line-height: 1.5;">Olá, <strong>${nome}</strong>!</p>
        <p style="color: #4b5563; line-height: 1.5;">
          ${
            convidadoPorEmail
              ? `<strong>${convidadoPorEmail}</strong> convidou você para acessar a plataforma `
              : "Você foi convidado(a) para acessar a plataforma "
          }
          <strong>Diversidade.io</strong> como <strong>${papel === "admin" ? "Administrador" : "Usuário Comum"}</strong>.
        </p>
        <p style="color: #4b5563; line-height: 1.5;">Clique no botão abaixo para definir sua senha e acessar o sistema:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${linkAcesso}" style="background-color: #7030A0; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Definir Senha e Acessar
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px;">Se você não esperava esse convite, pode ignorar este e-mail.</p>
        <p style="color: #4b5563; margin-top: 30px;">Atenciosamente,<br><strong>Equipe Diversidade.io</strong></p>
      </div>
    `;

    const resend = new Resend(RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: "Diversidade.io <nao-responder@diversidade.io>",
      to: email,
      subject: "Convite para acessar a Diversidade.io",
      html: htmlConvite,
    });

    if (emailError) {
      console.error("Erro ao enviar e-mail de convite:", emailError);
      return res
        .status(500)
        .json({ erro: "Erro ao enviar e-mail de convite." });
    }

    return res.json({ sucesso: true, mensagem: "Convite enviado com sucesso!" });
  } catch (err) {
    console.error("Erro no endpoint /api/convidar-usuario:", err);
    return res
      .status(500)
      .json({ erro: "Erro interno: " + (err.message || "Desconhecido") });
  }
}
