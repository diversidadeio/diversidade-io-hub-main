import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

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
      const emails = [...new Set(logsCompletos.map((l: any) => l.email).filter(Boolean))];
      
      if (emails.length > 0) {
        const { data: usuariosInfo } = await supabaseAdmin
          .from('empresas')
          .select('email, nome_responsavel, razao_social, nome_fantasia')
          .in('email', emails as string[]);

        if (usuariosInfo) {
          const mapUsuarios: Record<string, any> = {};
          usuariosInfo.forEach(u => {
            mapUsuarios[u.email] = {
              nome: u.nome_responsavel,
              empresa: u.razao_social || u.nome_fantasia || 'Administração'
            };
          });

          logsCompletos.forEach((l: any) => {
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
}
