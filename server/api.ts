import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { createHash } from "crypto";

export const apiRouter = Router();

// Certifique-se de que o servidor tenha acesso às variáveis de ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Cliente anonkey (para RPCs públicas)
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Cliente service_role (para admin operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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

/**
 * Endpoint de migração de senha:
 * Verifica a senha antiga (SHA-256 na tabela empresas) e, se correta,
 * atualiza automaticamente a senha no Supabase Auth via service_role.
 * Isso permite que usuários antigos façam login com sua senha original
 * sem precisar fazer reset manual.
 */
apiRouter.post("/migrar-senha", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    }

    // 1. Calcula o hash SHA-256 da senha fornecida
    const senhaHash = createHash('sha256').update(senha).digest('hex');

    // 2. Verifica se o hash bate com o da tabela empresas
    const { data: empresa, error: dbError } = await supabaseAdmin
      .from('empresas')
      .select('id, email, nome_responsavel, tipo_usuario')
      .eq('email', email)
      .eq('senha_hash', senhaHash)
      .single();

    if (dbError || !empresa) {
      return res.status(401).json({ erro: "Senha antiga não confere." });
    }

    // 3. Busca o usuário no Supabase Auth pelo e-mail
    const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return res.status(500).json({ erro: "Erro ao buscar usuários." });
    }

    const authUser = authList.users.find(u => u.email === email);
    if (!authUser) {
      return res.status(404).json({ erro: "Usuário não encontrado no Auth." });
    }

    // 4. Atualiza a senha no Supabase Auth para a senha fornecida (em texto plano)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: senha }
    );

    if (updateError) {
      return res.status(500).json({ erro: "Erro ao atualizar senha: " + updateError.message });
    }

    return res.json({ sucesso: true, mensagem: "Senha migrada com sucesso." });
  } catch (err: any) {
    console.error("Erro no endpoint /migrar-senha:", err);
    res.status(500).json({ erro: "Erro interno do servidor." });
  }
});

/**
 * Endpoint de convite de usuário:
 * Cria o usuário no Supabase Auth, insere na empresa_usuarios
 * e envia e-mail de convite com link para definir senha.
 */
apiRouter.post("/convidar-usuario", async (req, res) => {
  try {
    const { empresaId, nome, email, papel, convidadoPorEmail } = req.body;
    if (!empresaId || !nome || !email || !papel) {
      return res.status(400).json({ erro: "Dados incompletos." });
    }

    // 1. Verificar se já existe no Auth
    const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return res.status(500).json({ erro: "Erro ao verificar usuários." });
    }

    let authUserId: string;
    const usuarioExistente = authList.users.find(u => u.email === email);

    if (usuarioExistente) {
      authUserId = usuarioExistente.id;
    } else {
      // 2. Criar usuário no Supabase Auth
      const { data: novoAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nome }
      });
      if (createError || !novoAuth.user) {
        return res.status(500).json({ erro: "Erro ao criar usuário: " + createError?.message });
      }
      authUserId = novoAuth.user.id;
    }

    // 3. Inserir ou atualizar na tabela empresa_usuarios
    const { error: dbError } = await supabaseAdmin
      .from('empresa_usuarios')
      .upsert({
        auth_user_id: authUserId,
        empresa_id: empresaId,
        nome,
        email,
        papel,
        status: 'pendente'
      }, { onConflict: 'auth_user_id,empresa_id' });

    if (dbError) {
      return res.status(500).json({ erro: "Erro ao salvar no banco: " + dbError.message });
    }

    // 4. Gerar link de recuperação (para usuário definir a senha)
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email
    });
    const linkAcesso = linkData?.properties?.action_link || "https://app.diversidade.io/login";

    // 5. Enviar e-mail de convite via SMTP
    const SMTP_HOST = process.env.SMTP_HOST || "smtp.office365.com";
    const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_USER || !SMTP_PASS) {
      console.warn("[Convite Simulado]", { email, linkAcesso });
      return res.json({ sucesso: true, mensagem: "Convite simulado (SMTP não configurado)." });
    }

    const htmlConvite = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #7030A0; margin: 0;">Diversidade.io</h1>
        </div>
        <h2 style="color: #111827; font-size: 20px;">Você foi convidado(a)!</h2>
        <p style="color: #4b5563; line-height: 1.5;">Olá, <strong>${nome}</strong>!</p>
        <p style="color: #4b5563; line-height: 1.5;">
          ${convidadoPorEmail ? `<strong>${convidadoPorEmail}</strong> convidou você para acessar a plataforma ` : "Você foi convidado(a) para acessar a plataforma "}
          <strong>Diversidade.io</strong> como <strong>${papel === 'admin' ? 'Administrador' : 'Usuário Comum'}</strong>.
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

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: `"Diversidade.io" <${SMTP_USER}>`,
      to: email,
      subject: "Convite para acessar a Diversidade.io",
      html: htmlConvite,
    });

    return res.json({ sucesso: true, mensagem: "Convite enviado com sucesso!" });

  } catch (err: any) {
    console.error("Erro no endpoint /convidar-usuario:", err);
    res.status(500).json({ erro: "Erro interno: " + err.message });
  }
});
