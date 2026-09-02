import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { createHash } from "crypto";
import OpenAI from "openai";

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

    // 1. Chama a RPC para gerar a senha temporária e salvar o hash em empresas
    const { data: novaSenha, error: rpcError } = await supabase.rpc("solicitar_recuperacao_senha", {
      p_email: email,
    });

    if (rpcError) {
      console.error("Erro na RPC solicitar_recuperacao_senha:", rpcError);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    if (!novaSenha) {
      return res.status(404).json({ erro: "Este e-mail não está cadastrado em nosso sistema." });
    }

    // 2. Busca o usuário no Supabase Auth pelo e-mail
    let authUserId: string | null = null;
    
    // Tenta encontrar o usuário na tabela empresa_usuarios
    const { data: userData, error: userError } = await supabaseAdmin
      .from('empresa_usuarios')
      .select('auth_user_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (userData?.auth_user_id) {
      authUserId = userData.auth_user_id;
    } else {
      // Fallback para buscar na lista de usuários (caso não esteja em empresa_usuarios)
      const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError) {
        const authUser = authList.users.find((u) => u.email === email);
        if (authUser) {
          authUserId = authUser.id;
        }
      }
    }

    if (authUserId) {
      // 3. Atualiza a senha no Supabase Auth para coincidir com a senha temporária
      // Isso garante que o login funcione com a senha enviada por e-mail
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: novaSenha }
      );
      if (updateError) {
        console.warn("Aviso: não foi possível atualizar o Supabase Auth:", updateError.message);
        // Não bloqueia o fluxo — o e-mail ainda será enviado
      }
    } else {
      console.warn("Aviso: authUserId não encontrado para o e-mail:", email);
    }

    // 4. Enviar o e-mail via SMTP (Office 365)
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

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
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
      return res.status(500).json({ erro: "Erro ao enviar e-mail: " + (emailErr.message || "Falha na autenticação SMTP.") });
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
    let authUserId: string | null = null;
    
    // Tenta encontrar o usuário na tabela empresa_usuarios
    const { data: userData } = await supabaseAdmin
      .from('empresa_usuarios')
      .select('auth_user_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
      
    if (userData?.auth_user_id) {
      authUserId = userData.auth_user_id;
    } else {
      // Fallback
      const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        return res.status(500).json({ erro: "Erro ao buscar usuários." });
      }
      const authUser = authList.users.find(u => u.email === email);
      if (authUser) {
        authUserId = authUser.id;
      }
    }

    if (!authUserId) {
      return res.status(404).json({ erro: "Usuário não encontrado no Auth." });
    }

    // 4. Atualiza a senha no Supabase Auth para a senha fornecida (em texto plano)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUserId,
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

    // 1. Verificar se já existe no Auth consultando empresa_usuarios (método mais rápido e confiável)
    let authUserId: string | null = null;
    
    const { data: userData } = await supabaseAdmin
      .from('empresa_usuarios')
      .select('auth_user_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (userData?.auth_user_id) {
      authUserId = userData.auth_user_id;
    } else {
      // Fallback para listUsers (caso exista no Auth mas não no empresa_usuarios)
      const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError) {
        const usuarioExistente = authList.users.find(u => u.email === email);
        if (usuarioExistente) {
          authUserId = usuarioExistente.id;
        }
      }
    }

    if (!authUserId) {
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

/**
 * Endpoint para envio de e-mail de aprovação de cadastro:
 * Usado pelo painel de admin localmente (via nodemailer).
 */
apiRouter.post("/enviar-email-aprovacao", async (req, res) => {
  try {
    const { email, nome } = req.body;
    if (!email) {
      return res.status(400).json({ erro: "E-mail não fornecido." });
    }

    const SMTP_HOST = process.env.SMTP_HOST || "smtp.office365.com";
    const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_USER || !SMTP_PASS) {
      console.warn("[E-mail de Aprovação Simulado]", { email, nome });
      return res.json({ sucesso: true, mensagem: "E-mail simulado (SMTP não configurado)." });
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
      subject: "✅ Seu cadastro foi aprovado! — Diversidade.io",
      html: htmlBody,
    });

    return res.json({ sucesso: true, mensagem: "E-mail enviado com sucesso!" });

  } catch (err: any) {
    console.error("Erro no endpoint /enviar-email-aprovacao:", err);
    res.status(500).json({ erro: "Erro interno: " + err.message });
  }
});

/**
 * Notificação para administradores sobre nova solicitação de busca
 */
apiRouter.post("/enviar-email-nova-solicitacao-busca", async (req, res) => {
  try {
    const { empresaId, cnaes, cidade, modalidade, descricao } = req.body;
    if (!empresaId) {
      return res.status(400).json({ erro: "empresaId não fornecido." });
    }

    // Busca nome da empresa para enriquecer o e-mail
    const { data: empresa } = await supabaseAdmin
      .from('empresas')
      .select('razao_social')
      .eq('id', empresaId)
      .single();

    const nomeEmpresa = empresa?.razao_social || "Empresa Não Identificada";

    const SMTP_HOST = process.env.SMTP_HOST || "smtp.office365.com";
    const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_USER || !SMTP_PASS) {
      console.warn("[Nova Solicitação Simulado]", { nomeEmpresa, cnaes, cidade });
      return res.json({ sucesso: true, mensagem: "E-mail simulado (SMTP não configurado)." });
    }

    // LISTA DE NOTIFICADOS - Inicialmente apenas tecnologia@diversidade.io
    const destinatarios = [
      "tecnologia@diversidade.io"
    ];

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #7030A0; font-size: 28px; margin: 0;">Diversidade.io</h1>
        </div>

        <div style="background: #f9f5ff; border-radius: 12px; padding: 32px; border: 1px solid #e9d5ff;">
          <h2 style="color: #1f2937; margin-top: 0;">📢 Nova Solicitação de Busca</h2>
          <p style="color: #374151; line-height: 1.6;">
            A empresa <strong>${nomeEmpresa}</strong> acabou de enviar uma nova solicitação de busca de empreendedores.
          </p>
          
          <div style="background: #ffffff; border-radius: 8px; padding: 16px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 12px 0;"><strong>CNAEs desejados:</strong><br/>${(cnaes || []).join(', ')}</p>
            <p style="margin: 0 0 12px 0;"><strong>Cidade:</strong><br/>${cidade}</p>
            <p style="margin: 0 0 12px 0;"><strong>Modalidade:</strong><br/>${modalidade}</p>
            ${descricao ? `<p style="margin: 0;"><strong>Detalhes/Observações:</strong><br/>${descricao}</p>` : ''}
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a
              href="https://www.diversidade.io/adm/solicitacoes/busca"
              style="background: #7030A0; color: white; padding: 14px 32px; border-radius: 8px;
                     text-decoration: none; font-weight: bold; font-size: 16px;"
            >
              Acessar Painel ADM
            </a>
          </div>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          Este é um e-mail automático enviado pela plataforma Diversidade.io.
        </p>
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
      to: destinatarios.join(", "),
      subject: `📢 Nova Solicitação de Busca - ${nomeEmpresa}`,
      html: htmlBody,
    });

    return res.json({ sucesso: true, mensagem: "E-mail de notificação enviado com sucesso!" });

  } catch (err: any) {
    console.error("Erro no endpoint /enviar-email-nova-solicitacao-busca:", err);
    res.status(500).json({ erro: "Erro interno: " + err.message });
  }
});

apiRouter.post("/enviar-email-exclusao-solicitacao-busca", async (req, res) => {
  try {
    const { emailDestino, nomeEmpresa, cnaes, modalidade } = req.body;
    if (!emailDestino) {
      return res.status(400).json({ erro: "E-mail de destino não fornecido." });
    }

    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("Faltam variáveis de ambiente SMTP.");
      return res.status(500).json({ erro: "Configuração SMTP ausente" });
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #7030A0; font-size: 28px; margin: 0;">Diversidade.io</h1>
        </div>

        <div style="background: #fff1f2; border-radius: 12px; padding: 32px; border: 1px solid #fecdd3;">
          <h2 style="color: #be123c; margin-top: 0;">Solicitação Excluída</h2>
          <p style="color: #374151; line-height: 1.6;">
            Olá, <strong>${nomeEmpresa || "Empresa Parceira"}</strong>,
          </p>
          <p style="color: #374151; line-height: 1.6;">
            Informamos que a sua solicitação de busca de empreendedores foi <strong>excluída</strong> pela administração da plataforma.
          </p>
          
          <div style="background: #ffffff; border-radius: 8px; padding: 16px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 12px 0;"><strong>CNAEs solicitados:</strong><br/>${(cnaes || []).join(', ')}</p>
            <p style="margin: 0;"><strong>Modalidade:</strong><br/>${modalidade}</p>
          </div>

          <p style="color: #374151; line-height: 1.6;">
            Se você acha que isso foi um engano ou deseja abrir uma nova solicitação, acesse o seu painel na Diversidade.io.
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          Este é um e-mail automático enviado pela plataforma Diversidade.io.
        </p>
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
      to: emailDestino,
      subject: `Aviso: Solicitação de Busca Excluída`,
      html: htmlBody,
    });

    return res.json({ sucesso: true, mensagem: "E-mail de notificação de exclusão enviado com sucesso!" });

  } catch (err: any) {
    console.error("Erro no endpoint /enviar-email-exclusao-solicitacao-busca:", err);
    res.status(500).json({ erro: "Erro interno: " + err.message });
  }
});

/**
 * Endpoint de registro de auditoria:
 * Recebe um evento do front-end, captura IP e user-agent reais do request
 * e insere o registro na tabela logs_acesso via RPC SECURITY DEFINER.
 * Retorna sempre HTTP 200 — logs nunca devem bloquear a interface do usuário.
 */
apiRouter.post("/registrar-log", async (req, res) => {
  try {
    const {
      email,
      tipo_evento,
      empresa_id,
      nome_empresa,
      executor_adm_email,
      detalhes,
    } = req.body;

    // Captura o IP real (considera proxies como Vercel/Nginx)
    const ip_address =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    // Captura o user-agent do navegador
    const user_agent = (req.headers["user-agent"] as string) || null;

    // Chama a RPC segura com service_role para contornar RLS
    // empresa_id no banco real é UUID, então passamos diretamente.
    const empresaIdParam = empresa_id || null;

    const { error } = await supabaseAdmin.rpc("registrar_log_acesso", {
      p_email: email || "desconhecido",
      p_tipo_evento: tipo_evento,
      p_empresa_id: empresaIdParam,
      p_nome_empresa: nome_empresa || null,
      p_executor_adm_email: executor_adm_email || null,
      p_ip_address: ip_address,
      p_user_agent: user_agent,
      p_detalhes: detalhes || null,
    });

    if (error) {
      console.error("Erro ao registrar log de auditoria:", error.message);
    }

    // Sempre retorna 200 — logs nunca bloqueiam a UI
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Erro no endpoint /registrar-log:", err);
    return res.status(200).json({ ok: true }); // ainda 200, logs são best-effort
  }
});

/**
 * Endpoint para leitura de logs de auditoria
 * Feito no servidor usando supabaseAdmin (service_role) para garantir
 * que a leitura funcione independente de limitações de RLS no front-end.
 */
apiRouter.post("/ler-logs", async (req, res) => {
  try {
    const { tipoEvento, emailBusca, empresaId, nomeEmpresa, periodo, page = 1, pageSize = 30 } = req.body;

    let q = supabaseAdmin.from("logs_acesso").select("*", { count: "exact" });

    // Filtros
    if (tipoEvento && tipoEvento !== "todos") {
      if (tipoEvento.includes("%")) {
        q = q.like("tipo_evento", tipoEvento);
      } else {
        q = q.eq("tipo_evento", tipoEvento);
      }
    }
    
    if (emailBusca && emailBusca.trim().length > 1) {
      q = q.ilike("email", `%${emailBusca.trim()}%`);
    }
    
    if (nomeEmpresa && nomeEmpresa.trim().length > 1) {
      q = q.ilike("nome_empresa", `%${nomeEmpresa.trim()}%`);
    }

    if (empresaId) {
      q = q.eq("empresa_id", empresaId);
    }

    if (periodo && periodo !== "todos") {
      const agora = new Date();
      if (periodo === "hoje") {
        agora.setHours(0, 0, 0, 0);
        q = q.gte("criado_em", agora.toISOString());
      } else if (periodo === "7d") {
        agora.setDate(agora.getDate() - 7);
        q = q.gte("criado_em", agora.toISOString());
      } else if (periodo === "30d") {
        agora.setDate(agora.getDate() - 30);
        q = q.gte("criado_em", agora.toISOString());
      }
    }

    // Paginação
    const de = (page - 1) * pageSize;
    const ate = de + pageSize - 1;
    
    const { data, error, count } = await q
      .order("criado_em", { ascending: false })
      .range(de, ate);

    if (error) throw error;

    const logsCompletos = data ? [...data] : [];
    
    if (logsCompletos.length > 0) {
      const emails = [...new Set(logsCompletos.map(l => l.email).filter(Boolean))];
      
      if (emails.length > 0) {
        const { data: usuariosInfo } = await supabaseAdmin
          .from('empresas')
          .select('email, nome_responsavel, razao_social, nome_fantasia')
          .in('email', emails);

        if (usuariosInfo) {
          const mapUsuarios: Record<string, any> = {};
          usuariosInfo.forEach(u => {
            mapUsuarios[u.email] = {
              nome: u.nome_responsavel,
              empresa: u.razao_social || u.nome_fantasia || 'Administração'
            };
          });

          logsCompletos.forEach(l => {
            if (mapUsuarios[l.email]) {
              l.executor_nome = mapUsuarios[l.email].nome;
              l.executor_empresa = mapUsuarios[l.email].empresa;
            }
          });
        }
      }
    }

    return res.json({ logs: logsCompletos, total: count || 0 });
  } catch (err: any) {
    console.error("Erro no endpoint /ler-logs:", err);
    return res.status(500).json({ erro: err.message });
  }
});

/**
 * Endpoint para obter as métricas de logs (Painel de Administração)
 */
apiRouter.get("/ler-logs-metricas", async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const seteDias = new Date();
    seteDias.setDate(seteDias.getDate() - 7);

    const [loginsHoje, falhasHoje, usuariosAtivos, acoesAdm] = await Promise.all([
      supabaseAdmin
        .from("logs_acesso")
        .select("*", { count: "exact", head: true })
        .eq("tipo_evento", "login_sucesso")
        .gte("criado_em", hoje.toISOString()),
      supabaseAdmin
        .from("logs_acesso")
        .select("*", { count: "exact", head: true })
        .eq("tipo_evento", "login_falha")
        .gte("criado_em", hoje.toISOString()),
      supabaseAdmin
        .from("logs_acesso")
        .select("email")
        .eq("tipo_evento", "login_sucesso")
        .gte("criado_em", seteDias.toISOString()),
      supabaseAdmin
        .from("logs_acesso")
        .select("*", { count: "exact", head: true })
        .like("tipo_evento", "adm_%")
        .gte("criado_em", seteDias.toISOString()),
    ]);

    const emailsUnicos = new Set((usuariosAtivos.data || []).map((l: any) => l.email));

    return res.json({
      loginsHoje: loginsHoje.count || 0,
      falhasHoje: falhasHoje.count || 0,
      usuariosAtivos7d: emailsUnicos.size,
      acoesAdm7d: acoesAdm.count || 0,
    });
  } catch (err: any) {
    console.error("Erro no endpoint /ler-logs-metricas:", err);
    return res.status(500).json({ erro: err.message });
  }
});

apiRouter.post("/verificar-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "E-mail é obrigatório." });

    const { data: d1 } = await supabaseAdmin.from('empresas').select('id').eq('email', email).limit(1).maybeSingle();
    const { data: d2 } = await supabaseAdmin.from('empresa_usuarios').select('id').eq('email', email).limit(1).maybeSingle();
    const { data: d3 } = await supabaseAdmin.from('administradores').select('id').eq('email', email).limit(1).maybeSingle();

    if (d1 || d2 || d3) {
      return res.json({ existe: true });
    }

    return res.json({ existe: false });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

apiRouter.post("/remover-usuario", async (req, res) => {
  try {
    const { empresaUsuarioId, empresaId, solicitanteEmail } = req.body;

    if (!empresaUsuarioId || !empresaId || !solicitanteEmail) {
      return res.status(400).json({ erro: "Dados incompletos." });
    }

    // 1. Valida pelo email quem esta solicitando a remocao e se e admin.
    const { data: solicitante, error: solicitanteError } = await supabaseAdmin
      .from("empresa_usuarios")
      .select("papel, auth_user_id")
      .eq("email", solicitanteEmail)
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .maybeSingle();

    if (solicitanteError || !solicitante) {
      return res.status(403).json({ erro: "Usuario solicitante nao encontrado na empresa." });
    }

    if (solicitante.papel !== "admin") {
      return res.status(403).json({ erro: "Apenas administradores podem remover usuarios." });
    }

    // 2. Busca o registro do usuario a ser removido
    const { data: usuarioAlvo, error: alvoError } = await supabaseAdmin
      .from("empresa_usuarios")
      .select("auth_user_id, email, empresa_id")
      .eq("id", empresaUsuarioId)
      .maybeSingle();

    if (alvoError || !usuarioAlvo) {
      return res.status(404).json({ erro: "Usuario a ser removido nao encontrado." });
    }

    // 3. Garante que o usuario alvo pertence a mesma empresa
    if (usuarioAlvo.empresa_id !== empresaId) {
      return res.status(403).json({ erro: "O usuario nao pertence a esta empresa." });
    }

    // 4. Garante que o admin nao esta tentando se remover
    if (usuarioAlvo.email === solicitanteEmail) {
      return res.status(400).json({ erro: "Voce nao pode remover a si mesmo." });
    }

    // 5. Remove da tabela empresa_usuarios
    const { error: deleteDbError } = await supabaseAdmin
      .from("empresa_usuarios")
      .delete()
      .eq("id", empresaUsuarioId);

    if (deleteDbError) {
      return res.status(500).json({ erro: "Erro ao remover do banco: " + deleteDbError.message });
    }

    // 6. Verifica se o usuario pertence a outras empresas antes de deletar do Auth
    const { data: outrasEmpresas } = await supabaseAdmin
      .from("empresa_usuarios")
      .select("id")
      .eq("auth_user_id", usuarioAlvo.auth_user_id)
      .limit(1);

    // So deleta do Supabase Auth se nao pertencer a nenhuma outra empresa
    if (!outrasEmpresas || outrasEmpresas.length === 0) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        usuarioAlvo.auth_user_id
      );
      if (deleteAuthError) {
        console.warn("Aviso: usuario removido da empresa mas nao do Auth:", deleteAuthError.message);
      }
    }

    return res.json({ sucesso: true, mensagem: "Usuario removido com sucesso." });
  } catch (err: any) {
    console.error("Erro no endpoint /remover-usuario:", err);
    return res.status(500).json({ erro: "Erro interno: " + (err.message || "Desconhecido") });
  }
});

/**
 * Busca com IA — retorna as 10 empresas mais relevantes para a necessidade descrita
 * Exclusivo para empresas do tipo "EMPRESA OU INICIATIVA INCENTIVADORA"
 */
apiRouter.post("/busca-ia", async (req, res) => {
  try {
    const { descricao, empresaId, isAdmin, adminEmail } = req.body;

    // Validações básicas
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 5) {
      return res.status(400).json({ erro: "Descreva com mais detalhes o que você precisa (mínimo 5 caracteres)." });
    }
    
    if (!isAdmin && !empresaId) {
      return res.status(400).json({ erro: "Empresa não identificada." });
    }

    let solicitanteEmail = adminEmail || "";

    // Verifica se a empresa solicitante é incentivadora (se não for admin)
    if (!isAdmin) {
      const { data: solicitante } = await supabaseAdmin
        .from("empresas")
        .select("acesso_tipo, razao_social, email")
        .eq("id", empresaId)
        .single();

      if (!solicitante?.acesso_tipo?.toUpperCase().includes("EMPRESA OU INICIATIVA INCENTIVADORA")) {
        return res.status(403).json({ erro: "Acesso não permitido para este tipo de empresa." });
      }
      solicitanteEmail = solicitante.email;
    }

    // ── Pré-filtragem por palavras-chave ──────────────────────────────────────
    // Extrai palavras significativas da query do usuário (remove artigos/preposições comuns)
    const STOP_WORDS = new Set([
      "de", "da", "do", "das", "dos", "um", "uma", "uns", "umas", "o", "a", "os", "as",
      "para", "por", "com", "em", "no", "na", "nos", "nas", "e", "ou", "que", "se",
      "como", "mais", "mas", "ao", "aos", "à", "às", "pelo", "pela", "pelos", "pelas",
      "ser", "ter", "fazer", "meu", "minha", "seu", "sua", "preciso", "quero", "busco",
      "procuro", "estou", "estamos", "precisamos", "queremos",
    ]);

    const palavrasChave = descricao
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúàâêîôûãõüç\s]/gi, " ")
      .split(/\s+/)
      .filter((p) => p.length >= 4 && !STOP_WORDS.has(p));

    // Monta filtro OR para atividade_empresarial usando as palavras-chave
    const filtrosAtividade = palavrasChave.map((p) => `atividade_empresarial.ilike.%${p}%`).join(",");
    const filtrosSobre = palavrasChave.map((p) => `sobre_empresa.ilike.%${p}%`).join(",");

    let baseQuery = supabaseAdmin
      .from("empresas")
      .select("id, razao_social, cnpj, email, nome_responsavel, atividade_empresarial, area_empresa, sobre_empresa")
      .eq("status_aprovacao", "aprovado")
      .neq("tipo_usuario", "adm")
      .eq("autoriza_compartilhamento", "Sim")
      .not("acesso_tipo", "ilike", "%EMPRESA OU INICIATIVA INCENTIVADORA%");

    if (empresaId) {
      baseQuery = baseQuery.neq("id", empresaId);
    }

    // Etapa 1: busca por palavras-chave na atividade empresarial
    let { data: empresasFiltradas, error: erroEmpresasData } = palavrasChave.length > 0
      ? await baseQuery.or(filtrosAtividade)
      : await baseQuery;

    if (erroEmpresasData) {
      console.error("[busca-ia] Erro ao buscar empresas (pré-filtro):", erroEmpresasData);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    // Etapa 2: se encontrou menos de 5 resultados, amplia para buscar em sobre_empresa também
    if (palavrasChave.length > 0 && (empresasFiltradas?.length ?? 0) < 5) {
      let queryAmpliada = supabaseAdmin
        .from("empresas")
        .select("id, razao_social, cnpj, email, nome_responsavel, atividade_empresarial, area_empresa, sobre_empresa")
        .eq("status_aprovacao", "aprovado")
        .neq("tipo_usuario", "adm")
        .eq("autoriza_compartilhamento", "Sim")
        .not("acesso_tipo", "ilike", "%EMPRESA OU INICIATIVA INCENTIVADORA%");

      if (empresaId) {
        queryAmpliada = queryAmpliada.neq("id", empresaId);
      }
      
      const { data: empresasAmpladas } = await queryAmpliada.or(`${filtrosAtividade},${filtrosSobre}`);

      // Mescla e deduplica por ID
      const idsJaVistos = new Set((empresasFiltradas || []).map((e: any) => e.id));
      const extras = (empresasAmpladas || []).filter((e: any) => !idsJaVistos.has(e.id));
      empresasFiltradas = [...(empresasFiltradas || []), ...extras];
    }

    const empresas = empresasFiltradas || [];
    // ── Fim da pré-filtragem ──────────────────────────────────────────────────

    if (erroEmpresasData) {
      console.error("[busca-ia] Erro ao buscar empresas:", erroEmpresasData);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    if (!empresas || empresas.length === 0) {
      return res.json({ resultados: [], mensagem: "Nenhuma empresa cadastrada possui atividade relacionada ao que você descreveu." });
    }

    console.log(`[busca-ia] Pré-filtro: ${empresas.length} candidatas para "${descricao.trim().slice(0, 60)}"`);

    // Monta contexto compacto das empresas para o prompt
    const contextoEmpresas = empresas
      .map((e: any) => {
        const atividade = e.atividade_empresarial || e.area_empresa || "Não informado";
        const sobre = e.sobre_empresa ? e.sobre_empresa.slice(0, 100) : "";
        return `ID:${e.id} | ${e.razao_social} | Atividade: ${atividade}${sobre ? " | Sobre: " + sobre : ""}`;
      })
      .join("\n");

    // Verifica se a chave da OpenAI está configurada
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("[busca-ia] OPENAI_API_KEY não configurada.");
      return res.status(500).json({ erro: "Serviço de IA não configurado. Entre em contato com o suporte." });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Prompt para o modelo
    const prompt = `Você é um assistente de matchmaking empresarial para a plataforma Diversidade.io.

TAREFA: Encontrar empresas cujas ATIVIDADES REAIS correspondam ao que o usuário precisa.

O usuário precisa de:
"${descricao.trim()}"

REGRAS OBRIGATÓRIAS — leia com atenção antes de responder:
1. Analise o campo "atividade" de cada empresa na lista abaixo.
2. Inclua uma empresa SOMENTE se a atividade dela tiver correspondência DIRETA e REAL com o que o usuário precisa. Não invente, não suponha.
3. A justificativa deve ser baseada EXCLUSIVAMENTE no texto da atividade da empresa. NUNCA invente serviços que a empresa não declarou.
4. Se uma empresa é confeitaria, cabeleireiro, arquitetura ou qualquer área não relacionada ao pedido, NÃO a inclua.
5. Retorne até 10 empresas relevantes. Se houver menos de 10 com correspondência real, retorne apenas as que realmente correspondem. Se não houver nenhuma, retorne lista vazia.
6. Ordene da mais relevante para a menos relevante.

Formato de resposta (JSON válido, sem texto extra):
{
  "resultados": [
    { "id": "uuid-exato-da-lista", "justificativa": "Frase baseada na atividade real da empresa (máx. 120 chars)" }
  ]
}

Lista de empresas (formato: ID | Nome | Atividade):
${contextoEmpresas}`;

    // Chama o GPT-4o-mini
    const resposta = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um sistema de matchmaking preciso. Retorne apenas JSON válido. Nunca inclua empresas que não sejam genuinamente relevantes. Nunca invente serviços que a empresa não declarou em suas atividades." },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const conteudoResposta = resposta.choices[0]?.message?.content || "{}";
    let resultadosIA: { id: string; justificativa: string }[] = [];

    try {
      const parsed = JSON.parse(conteudoResposta);
      resultadosIA = parsed.resultados || [];
    } catch {
      console.error("[busca-ia] Erro ao parsear resposta da IA:", conteudoResposta);
      return res.status(500).json({ erro: "A IA retornou uma resposta inválida. Tente novamente." });
    }

    // Cruza os IDs da IA com os dados completos das empresas para montar a resposta
    const mapaEmpresas = new Map(empresas.map((e: any) => [e.id, e]));
    const resultadosEnriquecidos = resultadosIA
      .filter((r) => mapaEmpresas.has(r.id))
      .slice(0, 10)
      .map((r) => {
        const empresa: any = mapaEmpresas.get(r.id);
        return {
          id: empresa.id,
          razao_social: empresa.razao_social,
          cnpj: empresa.cnpj,
          email: empresa.email,
          nome_responsavel: empresa.nome_responsavel,
          atividade_empresarial: empresa.atividade_empresarial || empresa.area_empresa,
          justificativa: r.justificativa,
        };
      });

    // Registra log de auditoria e salva no histórico de buscas IA
    try {
      await Promise.all([
        // Log de auditoria (logs_acesso)
        supabaseAdmin.from("logs_acesso").insert({
          empresa_id: isAdmin ? null : empresaId,
          email: solicitanteEmail,
          tipo_evento: "ia_busca_empresas",
          detalhes: `Busca: "${descricao.trim().slice(0, 200)}" | Resultados: ${resultadosEnriquecidos.length}`,
        }),
        // Histórico de buscas com resultados completos
        supabaseAdmin.from("historico_buscas_ia").insert({
          empresa_id: isAdmin ? null : empresaId,
          admin_email: isAdmin ? solicitanteEmail : null,
          descricao: descricao.trim(),
          resultados: resultadosEnriquecidos,
          total_resultados: resultadosEnriquecidos.length,
        }),
      ]);
    } catch (erroLog) {
      console.warn("[busca-ia] Falha ao registrar log/histórico:", erroLog);
    }

    return res.json({ resultados: resultadosEnriquecidos });

  } catch (err: any) {
    console.error("Erro no endpoint /busca-ia:", err);
    return res.status(500).json({ erro: "Erro interno. Tente novamente em instantes." });
  }
});

apiRouter.get("/historico-buscas-ia", async (req, res) => {
  try {
    const empresaId = req.query?.empresaId as string;
    const adminEmail = req.query?.adminEmail as string;
    const isAdmin = req.query?.isAdmin === 'true';

    if (!isAdmin && !empresaId) {
      return res.status(400).json({ erro: "empresaId ou adminEmail é obrigatório." });
    }

    // Verifica se a empresa solicitante é incentivadora (se não for admin)
    if (!isAdmin) {
      const { data: empresa, error: erroEmpresa } = await supabaseAdmin
        .from("empresas")
        .select("acesso_tipo")
        .eq("id", empresaId)
        .single();

      if (erroEmpresa || !empresa) {
        return res.status(404).json({ erro: "Empresa não encontrada." });
      }

      if (!empresa.acesso_tipo?.toUpperCase().includes("EMPRESA OU INICIATIVA INCENTIVADORA")) {
        return res.status(403).json({ erro: "Acesso não permitido para este tipo de empresa." });
      }
    }

    // Busca as últimas 20 buscas da empresa (ou admin), da mais recente para a mais antiga
    let query = supabaseAdmin
      .from("historico_buscas_ia")
      .select("id, descricao, resultados, total_resultados, criado_em")
      .order("criado_em", { ascending: false })
      .limit(20);
      
    if (isAdmin) {
      query = query.eq("admin_email", adminEmail);
    } else {
      query = query.eq("empresa_id", empresaId);
    }

    const { data: historico, error: erroHistorico } = await query;

    if (erroHistorico) {
      console.error("[historico-buscas-ia] Erro ao buscar histórico:", erroHistorico);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    return res.json({ historico: historico || [] });
  } catch (err: any) {
    console.error("[historico-buscas-ia] Erro interno:", err);
    return res.status(500).json({ erro: "Erro interno. Tente novamente em instantes." });
  }
});

import { Resend } from "resend";

apiRouter.get("/email-marketing", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ erro: "Não autorizado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ erro: "Token inválido" });
    }

    // Verifica se é admin
    const { data: adminData } = await supabaseAdmin
      .from('empresa_usuarios')
      .select('empresas(tipo_usuario)')
      .eq('auth_user_id', user.id)
      .single();

    if (!adminData || (adminData.empresas as any)?.tipo_usuario !== 'adm') {
      return res.status(403).json({ erro: "Acesso negado." });
    }

    const { data: campanhas, error: dbError } = await supabaseAdmin
      .from("campanhas_email")
      .select("*")
      .order("criado_em", { ascending: false });

    if (dbError) throw dbError;

    return res.json({ campanhas });
  } catch (err) {
    console.error("Erro ao buscar campanhas:", err);
    return res.status(500).json({ erro: "Erro ao buscar histórico." });
  }
});

apiRouter.post("/email-marketing", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ erro: "Não autorizado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ erro: "Token inválido" });
    }

    // Verifica se é admin
    const { data: adminData } = await supabaseAdmin
      .from('empresa_usuarios')
      .select('empresas(tipo_usuario)')
      .eq('auth_user_id', user.id)
      .single();

    if (!adminData || (adminData.empresas as any)?.tipo_usuario !== 'adm') {
      return res.status(403).json({ erro: "Acesso negado." });
    }

    const { assunto, corpoHtml, filtro, agendadoPara } = req.body;

    if (!assunto || !corpoHtml || !filtro) {
      return res.status(400).json({ erro: "Dados incompletos." });
    }

    const status = agendadoPara ? 'agendado' : 'rascunho';

    const { data: campanha, error: insertError } = await supabaseAdmin
      .from("campanhas_email")
      .insert({
        assunto,
        corpo_html: corpoHtml,
        filtro,
        agendado_para: agendadoPara || null,
        status: status,
        criado_por: user.id
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (agendadoPara) {
      return res.json({ sucesso: true, mensagem: "Campanha agendada com sucesso!", id: campanha.id });
    }

    let emailsDestino: string[] = [];
    let query = supabaseAdmin
      .from('empresas')
      .select('email, razao_social, empresa_usuarios(email, nome)')
      .neq('tipo_usuario', 'adm');

    if (filtro.tipo === 'tipo_acesso' && filtro.valores.length > 0) {
      query = query.in('tipo_acesso', filtro.valores);
    } else if (filtro.tipo === 'empresa' && filtro.valores.length > 0) {
      query = query.in('id', filtro.valores);
    }

    const { data: empresasData, error: qError } = await query;
    if (qError) throw qError;

    const emailSet = new Set<string>();
    
    empresasData.forEach(emp => {
      if (emp.email) emailSet.add(emp.email);
      if (emp.empresa_usuarios && emp.empresa_usuarios.length > 0) {
        emp.empresa_usuarios.forEach((eu: any) => {
          if (eu.email) emailSet.add(eu.email);
        });
      }
    });

    if (filtro.tipo === 'usuario' && filtro.valores.length > 0) {
      emailSet.clear();
      const { data: usuariosData, error: uError } = await supabaseAdmin
        .from('empresa_usuarios')
        .select('email')
        .in('auth_user_id', filtro.valores);
        
      if (!uError && usuariosData) {
        usuariosData.forEach(u => {
          if (u.email) emailSet.add(u.email);
        });
      }
    }

    emailsDestino = Array.from(emailSet);

    if (emailsDestino.length === 0) {
      await supabaseAdmin.from("campanhas_email").update({ status: 'erro' }).eq('id', campanha.id);
      return res.status(400).json({ erro: "Nenhum destinatário encontrado para o filtro." });
    }

    await supabaseAdmin.from("campanhas_email").update({ status: 'enviando' }).eq('id', campanha.id);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${corpoHtml}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
          <p>Você está recebendo este e-mail pois está cadastrado na plataforma Diversidade.io</p>
        </div>
      </div>
    `;

    let sentCount = 0;
    let hasError = false;

    if (RESEND_API_KEY) {
      const resend = new Resend(RESEND_API_KEY);
      const BATCH_SIZE = 100;
      for (let i = 0; i < emailsDestino.length; i += BATCH_SIZE) {
        const batch = emailsDestino.slice(i, i + BATCH_SIZE);
        const emailRequests = batch.map(email => ({
          from: "Diversidade.io <nao-responder@diversidade.io>",
          to: [email],
          subject: assunto,
          html: htmlTemplate,
        }));

        const { data, error } = await resend.batch.send(emailRequests);
        if (error) {
          console.error(`Erro no lote ${i}:`, error);
          hasError = true;
        } else {
          sentCount += batch.length;
        }
      }
    } else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const BATCH_SIZE = 50;
      for (let i = 0; i < emailsDestino.length; i += BATCH_SIZE) {
        const batch = emailsDestino.slice(i, i + BATCH_SIZE);
        try {
          await transporter.sendMail({
            from: `"Diversidade.io" <${SMTP_USER}>`,
            bcc: batch,
            subject: assunto,
            html: htmlTemplate,
          });
          sentCount += batch.length;
        } catch (error) {
           console.error(`Erro no nodemailer lote ${i}:`, error);
           hasError = true;
        }
      }
    } else {
      console.warn("[Simulação de Envio E-mail Marketing]", { emailsDestino, assunto });
      await supabaseAdmin.from("campanhas_email").update({ 
        status: 'enviado', 
        total_envios: emailsDestino.length,
        enviado_em: new Date().toISOString()
      }).eq('id', campanha.id);
      return res.json({ sucesso: true, mensagem: `Simulação: ${emailsDestino.length} e-mails enviados.` });
    }

    await supabaseAdmin.from("campanhas_email").update({ 
      status: hasError && sentCount === 0 ? 'erro' : 'enviado',
      total_envios: sentCount,
      enviado_em: new Date().toISOString()
    }).eq('id', campanha.id);

    return res.json({ 
      sucesso: true, 
      mensagem: `${sentCount} e-mails enviados.`,
      totalEnviados: sentCount
    });

  } catch (err) {
    console.error("Erro no endpoint POST /api/email-marketing:", err);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
});
