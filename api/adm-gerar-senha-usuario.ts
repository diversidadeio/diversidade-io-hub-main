import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const { auth_user_id, email_fallback } = req.body;
    if (!auth_user_id) {
      return res.status(400).json({ erro: "auth_user_id é obrigatório." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Gera senha aleatória de 8 caracteres alfanuméricos
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let senha = "";
    for (let i = 0; i < 8; i++) {
      senha += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Tenta atualizar pelo auth_user_id direto
    let { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      auth_user_id,
      { password: senha }
    );

    // Fallback: se não encontrou pelo ID, busca pelo e-mail
    if (updateError && updateError.message?.toLowerCase().includes("user not found") && email_fallback) {
      console.log(`[adm-gerar-senha-usuario] Fallback por e-mail: ${email_fallback}`);
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authList?.users?.find((u: any) => u.email === email_fallback);
      if (authUser) {
        const { error: retryError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          { password: senha }
        );
        if (retryError) {
          return res.status(500).json({ erro: "Erro ao atualizar senha: " + retryError.message });
        }
      } else {
        return res.status(404).json({ erro: "Usuário não encontrado no Auth (nem por ID nem por e-mail)." });
      }
    } else if (updateError) {
      return res.status(500).json({ erro: "Erro ao atualizar senha: " + updateError.message });
    }

    return res.json({ sucesso: true, senha });
  } catch (err: any) {
    console.error("Erro no endpoint /adm-gerar-senha-usuario:", err);
    return res.status(500).json({ erro: "Erro interno: " + (err.message || "Desconhecido") });
  }
}
