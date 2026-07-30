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
