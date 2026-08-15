import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Metodo nao permitido." });
  }

  try {
    const { empresaUsuarioId, empresaId, solicitanteEmail } = req.body;

    if (!empresaUsuarioId || !empresaId || !solicitanteEmail) {
      return res.status(400).json({ erro: "Dados incompletos." });
    }

    // 1. Valida pelo email quem esta solicitando a remocao e se e admin.
    // Usamos supabaseAdmin para garantir que a consulta bypassa RLS.
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
  } catch (err) {
    console.error("Erro no endpoint /api/remover-usuario:", err);
    return res.status(500).json({ erro: "Erro interno: " + (err.message || "Desconhecido") });
  }
}
