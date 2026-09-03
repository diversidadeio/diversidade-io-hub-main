import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ erro: "Configuração de banco de dados ausente." });
    }

    const senhaHash = createHash('sha256').update(senha).digest('hex');

    const { data: empresa, error: dbError } = await supabaseAdmin
      .from('empresas')
      .select('id, email, nome_responsavel, tipo_usuario')
      .eq('email', email)
      .eq('senha_hash', senhaHash)
      .single();

    if (dbError || !empresa) {
      return res.status(401).json({ erro: "Senha antiga não confere." });
    }

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
      const { data: authList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        return res.status(500).json({ erro: "Erro ao buscar usuários." });
      }
      const authUser = authList.users.find((u: any) => u.email === email);
      if (authUser) {
        authUserId = authUser.id;
      }
    }

    if (!authUserId) {
      return res.status(404).json({ erro: "Usuário não encontrado no Auth." });
    }

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
}
