import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  if (!supabaseAdmin) {
    console.error("Vercel Error: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente nas variáveis de ambiente.");
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

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

    let usuariosUnicosCount = 0;
    if (usuariosAtivos.data) {
      const uniqueEmails = new Set(usuariosAtivos.data.map(r => r.email));
      usuariosUnicosCount = uniqueEmails.size;
    }

    return res.json({
      loginsHoje: loginsHoje.count || 0,
      falhasHoje: falhasHoje.count || 0,
      usuariosAtivos7d: usuariosUnicosCount,
      acoesAdm7d: acoesAdm.count || 0,
    });
  } catch (err: any) {
    console.error("Erro no endpoint /ler-logs-metricas:", err);
    return res.status(500).json({ erro: err.message });
  }
}
