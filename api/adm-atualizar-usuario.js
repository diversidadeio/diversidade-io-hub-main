import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const {
      auth_user_id,
      empresa_usuario_id,
      empresa_id,
      empresa_principal,
      email_atual,
      nome,
      email,
      telefone,
    } = req.body;

    if (!auth_user_id || !empresa_id) {
      return res.status(400).json({ erro: "auth_user_id e empresa_id são obrigatórios." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const erros = [];

    // ─── Atualiza e-mail no Auth (se informado) ────────────────────────────────
    if (email) {
      let { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        auth_user_id,
        { email, email_confirm: true }
      );

      // Fallback: se não achou pelo ID, busca pelo e-mail atual
      if (authError && authError.message?.toLowerCase().includes("user not found") && email_atual) {
        console.log(`[adm-atualizar-usuario] Fallback por e-mail: ${email_atual}`);
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        const authUser = authList?.users?.find((u) => u.email === email_atual);
        if (authUser) {
          const { error: retryError } = await supabaseAdmin.auth.admin.updateUserById(
            authUser.id,
            { email, email_confirm: true }
          );
          if (retryError) {
            return res.status(500).json({ erro: "Erro ao atualizar e-mail no Auth: " + retryError.message });
          }
        } else {
          return res.status(404).json({ erro: "Usuário não encontrado no Auth. Verifique se este usuário possui acesso ativo à plataforma." });
        }
      } else if (authError) {
        return res.status(500).json({ erro: "Erro ao atualizar e-mail no Auth: " + authError.message });
      }
    }

    // ─── Atualiza na tabela empresa_usuarios (se tiver registro lá) ────────────
    if (empresa_usuario_id) {
      const camposEu = {};
      if (nome !== undefined && nome !== null)     camposEu.nome     = nome;
      if (email !== undefined && email !== null)   camposEu.email    = email;
      if (telefone !== undefined)                   camposEu.telefone = telefone;

      if (Object.keys(camposEu).length > 0) {
        const { error: euError } = await supabaseAdmin
          .from("empresa_usuarios")
          .update(camposEu)
          .eq("id", empresa_usuario_id);

        if (euError) erros.push("empresa_usuarios: " + euError.message);
      }
    }

    // ─── Se for o usuário principal, atualiza também a tabela empresas ─────────
    if (empresa_principal) {
      const camposEmp = {};
      if (email !== undefined && email !== null)       camposEmp.email              = email;
      if (nome !== undefined && nome !== null)         camposEmp.nome_responsavel   = nome;
      if (telefone !== undefined && telefone !== null) camposEmp.telefone_principal = telefone;

      if (Object.keys(camposEmp).length > 0) {
        const { error: empError } = await supabaseAdmin
          .from("empresas")
          .update(camposEmp)
          .eq("id", empresa_id);

        if (empError) erros.push("empresas: " + empError.message);
      }
    }

    if (erros.length > 0) {
      return res.status(500).json({ erro: "Erros parciais: " + erros.join("; ") });
    }

    return res.json({ sucesso: true, mensagem: "Dados atualizados com sucesso." });
  } catch (err) {
    console.error("Erro no endpoint /adm-atualizar-usuario:", err);
    return res.status(500).json({ erro: "Erro interno: " + (err.message || "Desconhecido") });
  }
}

