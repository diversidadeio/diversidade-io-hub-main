import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  if (!supabaseAdmin) {
    console.error("Vercel Error: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente nas variáveis de ambiente.");
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  try {
    const {
      email,
      tipo_evento,
      empresa_id,
      nome_empresa,
      executor_adm_email,
      detalhes,
    } = req.body;

    const ip_address =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const user_agent = (req.headers["user-agent"] as string) || null;

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
      return res.status(500).json({ erro: "Falha ao registrar log" });
    }

    return res.json({ sucesso: true });
  } catch (err: any) {
    console.error("Erro crítico em /registrar-log:", err);
    return res.status(500).json({ erro: "Falha no servidor" });
  }
}
