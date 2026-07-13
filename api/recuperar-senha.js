import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

/**
 * Serverless Function do Vercel para recuperação de senha.
 * Escrita em JavaScript puro para evitar problemas de compilação TypeScript no Vercel.
 */
export default async function handler(req, res) {
  // Apenas aceita o método POST
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ erro: "E-mail é obrigatório." });
    }

    // Lê as variáveis de ambiente do Supabase
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey =
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "";
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Variáveis de ambiente do Supabase não configuradas.");
      return res
        .status(500)
        .json({ erro: "Erro de configuração do servidor (Supabase)." });
    }

    // Cria o cliente Supabase e chama a RPC para gerar a senha temporária
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: novaSenha, error } = await supabase.rpc(
      "solicitar_recuperacao_senha",
      { p_email: email }
    );

    if (error) {
      console.error("Erro na RPC solicitar_recuperacao_senha:", error);
      return res
        .status(500)
        .json({ erro: "Erro ao consultar o banco de dados." });
    }

    if (!novaSenha) {
      return res
        .status(404)
        .json({ erro: "Este e-mail não está cadastrado em nosso sistema." });
    }

    // Tenta atualizar a senha no Supabase Auth usando o Service Role Key, se disponível
    if (supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      
      let authUserId = null;
      
      // Busca o ID do usuário na tabela empresa_usuarios
      const { data: userData } = await supabaseAdmin
        .from('empresa_usuarios')
        .select('auth_user_id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
        
      if (userData?.auth_user_id) {
        authUserId = userData.auth_user_id;
      } else {
        // Fallback: busca na lista de usuários
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        if (authList?.users) {
          const authUser = authList.users.find(u => u.email === email);
          if (authUser) authUserId = authUser.id;
        }
      }

      if (authUserId) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUserId,
          { password: novaSenha }
        );
        if (updateError) {
          console.warn("Aviso: não foi possível atualizar o Supabase Auth:", updateError.message);
        }
      } else {
        console.warn("Aviso: authUserId não encontrado para o e-mail:", email);
      }
    } else {
      console.warn("AVISO: SUPABASE_SERVICE_ROLE_KEY não configurada. A senha no Auth não será atualizada.");
    }

    // Verifica se a chave do Resend está configurada
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      // Modo simulado: senha gerada mas e-mail não enviado
      console.warn(
        "AVISO: RESEND_API_KEY não configurada. Modo simulado ativado."
      );
      console.log(
        "[E-mail Simulado] Para: " + email + " | Nova Senha: " + novaSenha
      );
      return res.json({
        sucesso: true,
        mensagem: "E-mail simulado (RESEND_API_KEY não configurada).",
      });
    }

    // Monta o HTML do e-mail
    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
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
          <strong style="font-size: 24px; color: #7030A0;">${novaSenha}</strong>
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

    // Envia o e-mail via Resend (API HTTP — funciona no Vercel sem bloqueio SMTP)
    const resend = new Resend(RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: "Diversidade.io <nao-responder@diversidade.io>",
      to: email,
      subject: "Recuperação de Senha - Diversidade.io",
      html: htmlEmail,
    });

    if (emailError) {
      console.error("Erro ao enviar e-mail via Resend:", emailError);
      return res
        .status(500)
        .json({ erro: "Erro ao enviar o e-mail de recuperação." });
    }

    return res.json({ sucesso: true, mensagem: "E-mail enviado com sucesso." });
  } catch (err) {
    console.error("Erro no endpoint /api/recuperar-senha:", err);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}
