import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const { action } = req.query;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "convidar") {
    try {
      const { empresaId, nome, email, papel, convidadoPorEmail } = req.body;
      if (!empresaId || !nome || !email || !papel) {
        return res.status(400).json({ erro: "Dados incompletos." });
      }

      let authUserId = null;
      const { data: userData } = await supabaseAdmin.from("empresa_usuarios").select("auth_user_id").eq("email", email).limit(1).maybeSingle();
      if (userData?.auth_user_id) {
        authUserId = userData.auth_user_id;
      } else {
        const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (!listError) {
          const usuarioExistente = authList.users.find((u) => u.email === email);
          if (usuarioExistente) {
            authUserId = usuarioExistente.id;
          }
        }
      }

      if (!authUserId) {
        const { data: novoAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email, email_confirm: true, user_metadata: { nome },
        });
        if (createError || !novoAuth.user) {
          return res.status(500).json({ erro: "Erro ao criar usuário: " + createError?.message });
        }
        authUserId = novoAuth.user.id;
      }

      const { error: dbError } = await supabaseAdmin.from("empresa_usuarios").upsert(
          { auth_user_id: authUserId, empresa_id: empresaId, nome, email, papel, status: "pendente" },
          { onConflict: "auth_user_id,empresa_id" }
      );
      if (dbError) return res.status(500).json({ erro: "Erro ao salvar no banco: " + dbError.message });

      const origin = req.body.origin || "https://www.diversidade.io";
      const redirectToUrl = `${origin}/trocar-senha`;
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery", email, options: { redirectTo: redirectToUrl },
      });
      const linkAcesso = linkData?.properties?.action_link || redirectToUrl;

      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (!RESEND_API_KEY) {
        console.warn("[Convite Simulado]", { email, linkAcesso });
        return res.json({ sucesso: true, mensagem: "Convite simulado (RESEND_API_KEY não configurada)." });
      }

      const htmlConvite = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;"><h1 style="color: #7030A0; margin: 0;">Diversidade.io</h1></div>
          <h2 style="color: #111827; font-size: 20px;">Você foi convidado(a)!</h2>
          <p style="color: #4b5563; line-height: 1.5;">Olá, <strong>${nome}</strong>!</p>
          <p style="color: #4b5563; line-height: 1.5;">
            ${convidadoPorEmail ? `<strong>${convidadoPorEmail}</strong> convidou você para acessar a plataforma ` : "Você foi convidado(a) para acessar a plataforma "}
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
        to: email, subject: "Convite para acessar a Diversidade.io", html: htmlConvite,
        text: `Olá ${nome}, você foi convidado. Acesse: ${linkAcesso}`
      });
      if (emailError) return res.status(500).json({ erro: "Erro ao enviar e-mail." });

      return res.json({ sucesso: true, mensagem: "Convite enviado com sucesso!" });
    } catch (err) {
      return res.status(500).json({ erro: "Erro interno: " + err.message });
    }
  }

  if (action === "remover") {
    try {
      const { empresaUsuarioId, empresaId, solicitanteEmail } = req.body;
      if (!empresaUsuarioId || !empresaId || !solicitanteEmail) return res.status(400).json({ erro: "Dados incompletos." });

      const { data: solicitante } = await supabaseAdmin.from("empresa_usuarios").select("papel, auth_user_id").eq("email", solicitanteEmail).eq("empresa_id", empresaId).eq("status", "ativo").maybeSingle();
      if (!solicitante || solicitante.papel !== "admin") return res.status(403).json({ erro: "Apenas administradores." });

      const { data: usuarioAlvo } = await supabaseAdmin.from("empresa_usuarios").select("auth_user_id, email, empresa_id").eq("id", empresaUsuarioId).maybeSingle();
      if (!usuarioAlvo || usuarioAlvo.empresa_id !== empresaId) return res.status(404).json({ erro: "Usuário inválido." });
      if (usuarioAlvo.email === solicitanteEmail) return res.status(400).json({ erro: "Você não pode remover a si mesmo." });

      await supabaseAdmin.from("empresa_usuarios").delete().eq("id", empresaUsuarioId);

      const { data: outrasEmpresas } = await supabaseAdmin.from("empresa_usuarios").select("id").eq("auth_user_id", usuarioAlvo.auth_user_id).limit(1);
      if (!outrasEmpresas || outrasEmpresas.length === 0) {
        await supabaseAdmin.auth.admin.deleteUser(usuarioAlvo.auth_user_id);
      }
      return res.json({ sucesso: true, mensagem: "Usuário removido." });
    } catch (err) {
      return res.status(500).json({ erro: "Erro interno: " + err.message });
    }
  }

  if (action === "atualizar") {
    try {
      const { auth_user_id, empresa_usuario_id, empresa_id, empresa_principal, email_atual, nome, email, telefone } = req.body;
      if (!auth_user_id || !empresa_id) return res.status(400).json({ erro: "auth_user_id e empresa_id obrigatórios." });

      const erros = [];
      if (email) {
        let { error: authError } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, { email, email_confirm: true });
        if (authError && authError.message?.toLowerCase().includes("user not found") && email_atual) {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = authList?.users?.find((u) => u.email === email_atual);
          if (authUser) {
            const { error: retryError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { email, email_confirm: true });
            if (retryError) return res.status(500).json({ erro: "Erro Auth: " + retryError.message });
          } else {
            return res.status(404).json({ erro: "Usuário não encontrado no Auth." });
          }
        } else if (authError) {
          if (authError.message?.toLowerCase().includes("already been registered")) {
            return res.status(400).json({ erro: "Este e-mail já está em uso por outro usuário no sistema." });
          }
          return res.status(500).json({ erro: "Erro Auth: " + authError.message });
        }
      }

      if (empresa_usuario_id) {
        const camposEu = {};
        if (nome !== undefined) camposEu.nome = nome;
        if (email !== undefined) camposEu.email = email;
        if (telefone !== undefined) camposEu.telefone = telefone;
        if (Object.keys(camposEu).length > 0) {
          const { error: euError } = await supabaseAdmin.from("empresa_usuarios").update(camposEu).eq("id", empresa_usuario_id);
          if (euError) erros.push(euError.message);
        }
      }

      if (empresa_principal) {
        const camposEmp = {};
        if (email !== undefined) camposEmp.email = email;
        if (nome !== undefined) camposEmp.nome_responsavel = nome;
        if (telefone !== undefined) camposEmp.telefone_principal = telefone;
        if (Object.keys(camposEmp).length > 0) {
          const { error: empError } = await supabaseAdmin.from("empresas").update(camposEmp).eq("id", empresa_id);
          if (empError) erros.push(empError.message);
        }
      }

      if (erros.length > 0) return res.status(500).json({ erro: "Erros parciais: " + erros.join(";") });
      return res.json({ sucesso: true, mensagem: "Atualizado." });
    } catch (err) {
      return res.status(500).json({ erro: "Erro: " + err.message });
    }
  }

  if (action === "gerar-senha") {
    try {
      const { auth_user_id, email_fallback } = req.body;
      if (!auth_user_id) return res.status(400).json({ erro: "auth_user_id obrigatório." });

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let senha = "";
      for (let i = 0; i < 8; i++) senha += chars.charAt(Math.floor(Math.random() * chars.length));

      let { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, { password: senha });
      if (updateError && updateError.message?.toLowerCase().includes("user not found") && email_fallback) {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = authList?.users?.find((u) => u.email === email_fallback);
        if (authUser) {
          const { error: retryError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: senha });
          if (retryError) return res.status(500).json({ erro: "Erro senha: " + retryError.message });
        } else {
          return res.status(404).json({ erro: "Usuário não encontrado." });
        }
      } else if (updateError) {
        return res.status(500).json({ erro: "Erro senha: " + updateError.message });
      }

      return res.json({ sucesso: true, senha });
    } catch (err) {
      return res.status(500).json({ erro: "Erro: " + err.message });
    }
  }

  return res.status(400).json({ erro: "Ação inválida." });
}
