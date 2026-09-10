import { supabaseAdmin, exigirAdm } from "./_auth";

/**
 * Início do dia corrente no fuso de Brasília, como instante UTC.
 *
 * A função roda na Vercel com TZ=UTC, então `setHours(0,0,0,0)` marcaria
 * 21h do dia anterior no horário brasileiro. O Brasil não adota mais
 * horário de verão, portanto o offset é fixo em -03:00.
 */
function inicioDoDiaBrasilia(): Date {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${dia}T00:00:00-03:00`);
}

export default async function handler(req: any, res: any) {
  const { action } = req.query;

  if (!supabaseAdmin) {
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  // Os logs de auditoria expõem e-mails, IPs e user agents de todos os
  // usuários: leitura restrita a administradores autenticados.
  if (!(await exigirAdm(req, res))) return;

  try {
    if (action === "metricas") {
      if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

      const hoje = inicioDoDiaBrasilia();
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
          .select("detalhes")
          .eq("tipo_evento", "login_falha")
          .gte("criado_em", hoje.toISOString()),
        // limit explícito: o PostgREST devolve no máximo 1000 linhas por
        // padrão, o que subestimaria a contagem de usuários únicos.
        supabaseAdmin
          .from("logs_acesso")
          .select("email")
          .eq("tipo_evento", "login_sucesso")
          .gte("criado_em", seteDias.toISOString())
          .limit(10000),
        supabaseAdmin
          .from("logs_acesso")
          .select("*", { count: "exact", head: true })
          .like("tipo_evento", "adm_%")
          .gte("criado_em", seteDias.toISOString()),
      ]);

      let usuariosUnicosCount = 0;
      if (usuariosAtivos.data) {
        const uniqueEmails = new Set(usuariosAtivos.data.map((r: any) => r.email));
        usuariosUnicosCount = uniqueEmails.size;
      }
      
      const falhasValidas = (falhasHoje.data || []).filter((f: any) => 
        !f.detalhes || !f.detalhes.includes("e-mail não cadastrado")
      );

      return res.json({
        loginsHoje: loginsHoje.count || 0,
        falhasHoje: falhasValidas.length,
        usuariosAtivos7d: usuariosUnicosCount,
        acoesAdm7d: acoesAdm.count || 0,
      });
    }
    
    if (action === "empresa") {
      if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });
      
      const { empresaId, nomeEmpresa, modo = "sobre_empresa", page = 1, pageSize = 20 } = req.body;

      if (modo === "sobre_empresa") {
        let q = supabaseAdmin.from("logs_acesso").select("*", { count: "exact" }).like("tipo_evento", "adm_%");

        if (empresaId) q = q.eq("empresa_id", empresaId);
        else if (nomeEmpresa && nomeEmpresa.trim().length > 1) q = q.ilike("nome_empresa", "%" + nomeEmpresa + "%");
        else return res.status(400).json({ erro: "Informe empresaId ou nomeEmpresa" });

        const de = (page - 1) * pageSize;
        const ate = de + pageSize - 1;

        const { data, error, count } = await q.order("criado_em", { ascending: false }).range(de, ate);
        if (error) throw error;
        return res.json({ logs: data || [], total: count || 0 });
      }

      if (modo === "usuarios_empresa") {
        let idResolvido: number | null = empresaId ?? null;

        if (!idResolvido && nomeEmpresa && nomeEmpresa.trim().length > 1) {
          const { data: empresasEncontradas } = await supabaseAdmin.from("empresas").select("id").ilike("razao_social", "%" + nomeEmpresa + "%").limit(5);
          if (!empresasEncontradas || empresasEncontradas.length === 0) {
            const { data: porFantasia } = await supabaseAdmin.from("empresas").select("id").ilike("nome_fantasia", "%" + nomeEmpresa + "%").limit(5);
            if (!porFantasia || porFantasia.length === 0) return res.json({ logs: [], total: 0, empresasEncontradas: 0 });
            idResolvido = porFantasia[0].id;
          } else {
            idResolvido = empresasEncontradas[0].id;
          }
        }

        if (!idResolvido) return res.status(400).json({ erro: "Informe empresaId ou nomeEmpresa" });

        const emailsSet = new Set<string>();
        const { data: empresaData } = await supabaseAdmin.from("empresas").select("email").eq("id", idResolvido).single();
        if (empresaData?.email) emailsSet.add(empresaData.email.toLowerCase());

        const { data: usuariosVinculados } = await supabaseAdmin.from("empresa_usuarios").select("email").eq("empresa_id", idResolvido);
        if (usuariosVinculados) usuariosVinculados.forEach((u: any) => { if (u.email) emailsSet.add(u.email.toLowerCase()); });

        const emails = Array.from(emailsSet);
        if (emails.length === 0) return res.json({ logs: [], total: 0, emails: [] });

        const de = (page - 1) * pageSize;
        const ate = de + pageSize - 1;

        const { data, error, count } = await supabaseAdmin.from("logs_acesso").select("*", { count: "exact" }).in("email", emails).not("tipo_evento", "like", "adm_%").order("criado_em", { ascending: false }).range(de, ate);
        if (error) throw error;
        return res.json({ logs: data || [], total: count || 0, emailsVinculados: emails });
      }
      return res.status(400).json({ erro: "Modo desconhecido: " + modo });
    }

    if (action === "geral") {
      if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

      const { tipoEvento, emailBusca, empresaId, nomeEmpresa, periodo, page = 1, pageSize = 30 } = req.body;
      let q = supabaseAdmin.from("logs_acesso").select("*", { count: "exact" });

      if (tipoEvento && tipoEvento !== "todos") {
        if (tipoEvento.includes("%")) q = q.like("tipo_evento", tipoEvento);
        else q = q.eq("tipo_evento", tipoEvento);
      }
      if (emailBusca && emailBusca.trim().length > 1) q = q.ilike("email", "%" + emailBusca + "%");
      if (nomeEmpresa && nomeEmpresa.trim().length > 1) q = q.ilike("nome_empresa", "%" + nomeEmpresa + "%");
      if (empresaId) q = q.eq("empresa_id", empresaId);

      if (periodo && periodo !== "todos") {
        const agora = new Date();
        if (periodo === "hoje") { q = q.gte("criado_em", inicioDoDiaBrasilia().toISOString()); }
        else if (periodo === "7d") { agora.setDate(agora.getDate() - 7); q = q.gte("criado_em", agora.toISOString()); }
        else if (periodo === "30d") { agora.setDate(agora.getDate() - 30); q = q.gte("criado_em", agora.toISOString()); }
      }

      const de = (page - 1) * pageSize;
      const ate = de + pageSize - 1;
      
      const { data, error, count } = await q.order("criado_em", { ascending: false }).range(de, ate);
      if (error) throw error;

      const logsCompletos = data ? [...data] : [];
      if (logsCompletos.length > 0) {
        const emails = [...new Set(logsCompletos.map((l: any) => l.email).filter(Boolean))];
        if (emails.length > 0) {
          const { data: usuariosInfo } = await supabaseAdmin.from('empresas').select('email, nome_responsavel, razao_social, nome_fantasia').in('email', emails as string[]);
          if (usuariosInfo) {
            const mapUsuarios: Record<string, any> = {};
            usuariosInfo.forEach((u: any) => { mapUsuarios[u.email] = { nome: u.nome_responsavel, empresa: u.razao_social || u.nome_fantasia || 'Administração' }; });
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
    }

    return res.status(404).json({ erro: "Ação não encontrada" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ erro: err.message });
  }
}

