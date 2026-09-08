import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  if (!supabaseAdmin) return res.status(500).json({ erro: "Configuração ausente" });

  try {
    const { data: logs, error } = await supabaseAdmin
      .from("logs_acesso")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(6000);

    if (error) throw error;

    const emailsComEventosValidos = new Set();
    const mapUsuarios = new Map();

    for (const log of (logs || [])) {
      if (!log.email) continue;
      if (log.tipo_evento !== "login_falha") {
        emailsComEventosValidos.add(log.email.toLowerCase());
      }
    }

    for (const log of (logs || [])) {
      if (!log.email) continue;
      const key = log.email.toLowerCase();
      
      if (!emailsComEventosValidos.has(key)) continue;

      if (!mapUsuarios.has(key)) {
        mapUsuarios.set(key, {
          email: log.email,
          empresa: "---", // será preenchido depois
          ultimoEvento: log.tipo_evento,
          ultimaAtividade: log.criado_em,
          ultimoLogin: null
        });
      }
    }

    const usuarios = Array.from(mapUsuarios.values());

    if (usuarios.length > 0) {
      const emails = usuarios.map((u: any) => u.email);
      
      const { data: ultimosLogins } = await supabaseAdmin
        .from("logs_acesso")
        .select("email, criado_em")
        .eq("tipo_evento", "login_sucesso")
        .in("email", emails)
        .order("criado_em", { ascending: false });
        
      for (const login of (ultimosLogins || [])) {
        const u = mapUsuarios.get(login.email.toLowerCase());
        if (u && !u.ultimoLogin) {
           u.ultimoLogin = login.criado_em;
        }
      }

      const { data: perfis } = await supabaseAdmin
        .from("empresas")
        .select("email, razao_social, nome_responsavel, tipo_usuario")
        .in("email", emails);
        
      for (const p of (perfis || [])) {
        if (!p.email) continue;
        const u = mapUsuarios.get(p.email.toLowerCase());
        if (u) {
          if (p.tipo_usuario === "adm") {
            u.empresa = p.nome_responsavel || "Administrador";
            u.isAdm = true;
          } else {
            u.empresa = p.razao_social || p.nome_responsavel || "Empresa";
            u.isAdm = false;
          }
        }
      }

      const { data: presencas } = await supabaseAdmin
        .from('user_presence')
        .select('email, last_seen')
        .in('email', emails);

      for (const pr of (presencas || [])) {
        if (!pr.email) continue;
        const u = mapUsuarios.get(pr.email.toLowerCase());
        if (u && pr.last_seen) {
          const dataPresence = new Date(pr.last_seen).getTime();
          const dataAtividadeLog = new Date(u.ultimaAtividade).getTime();
          if (dataPresence > dataAtividadeLog) {
            u.ultimaAtividade = pr.last_seen;
            u.ultimoEvento = u.ultimoEvento !== "logout" ? u.ultimoEvento : "ping_presence";
          }
        }
      }
    }

    const usuariosAtivos = Array.from(mapUsuarios.values()).filter((u: any) => u.empresa !== "---");

    return res.json({ usuarios: usuariosAtivos });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ erro: err.message });
  }
}
