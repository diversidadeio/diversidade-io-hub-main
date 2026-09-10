import { supabaseAdmin, exigirAdm } from "./_auth.js";
import {
  agregarUsuarios,
  janelaDoPeriodo,
  montarLinhasSolicitacoes,
  resumirPeriodo,
  serieAcessos,
  PERIODO_PADRAO,
} from "./_relatorio.js";

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

const COLUNAS_EMPRESA =
  "id, razao_social, nome_fantasia, cnpj, email, nome_responsavel, telefone_principal, " +
  "status_aprovacao, situacao_cnpj, area_empresa, area_geografica, created_at";

/**
 * Empresa a partir do id ou do texto digitado na busca.
 *
 * Mantém a ordem de preferência da tela de Logs: procura primeiro em
 * `razao_social` e só então em `nome_fantasia`.
 */
async function resolverEmpresa(empresaId?: string | null, nomeEmpresa?: string | null) {
  if (empresaId) {
    const { data } = await supabaseAdmin!
      .from("empresas")
      .select(COLUNAS_EMPRESA)
      .eq("id", empresaId)
      .single();
    return data || null;
  }

  const termo = (nomeEmpresa || "").trim();
  if (termo.length < 2) return null;

  const { data: porRazao } = await supabaseAdmin!
    .from("empresas")
    .select(COLUNAS_EMPRESA)
    .ilike("razao_social", "%" + termo + "%")
    .limit(5);
  if (porRazao && porRazao.length > 0) return porRazao[0];

  const { data: porFantasia } = await supabaseAdmin!
    .from("empresas")
    .select(COLUNAS_EMPRESA)
    .ilike("nome_fantasia", "%" + termo + "%")
    .limit(5);
  return porFantasia && porFantasia.length > 0 ? porFantasia[0] : null;
}

/**
 * Todo mundo que responde pela empresa: os convidados de `empresa_usuarios`
 * mais o responsável do cadastro (`empresas.email`).
 *
 * Os convidados entram primeiro de propósito — se o responsável também tiver
 * linha em `empresa_usuarios`, é a dela que vale, porque só ela carrega o
 * `auth_user_id` usado para creditar as solicitações de busca.
 */
async function membrosDaEmpresa(empresa: any) {
  const { data: vinculados } = await supabaseAdmin!
    .from("empresa_usuarios")
    .select("id, auth_user_id, nome, email, papel, status")
    .eq("empresa_id", empresa.id);

  const membros: any[] = [];
  const vistos = new Set<string>();

  const adicionar = (membro: any) => {
    const email = (membro.email || "").trim().toLowerCase();
    if (!email || vistos.has(email)) return;
    vistos.add(email);
    membros.push({ ...membro, email });
  };

  (vinculados || []).forEach(adicionar);
  if (empresa.email) {
    adicionar({
      id: null,
      auth_user_id: null,
      nome: empresa.nome_responsavel,
      email: empresa.email,
      papel: "responsavel",
      status: "ativo",
    });
  }

  return membros;
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
        if (!empresaId && (!nomeEmpresa || nomeEmpresa.trim().length < 2)) {
          return res.status(400).json({ erro: "Informe empresaId ou nomeEmpresa" });
        }

        const empresa = await resolverEmpresa(empresaId, nomeEmpresa);
        if (!empresa) return res.json({ logs: [], total: 0, empresasEncontradas: 0 });

        const emails = (await membrosDaEmpresa(empresa)).map((m: any) => m.email);
        if (emails.length === 0) return res.json({ logs: [], total: 0, emails: [] });

        const de = (page - 1) * pageSize;
        const ate = de + pageSize - 1;

        const { data, error, count } = await supabaseAdmin.from("logs_acesso").select("*", { count: "exact" }).in("email", emails).not("tipo_evento", "like", "adm_%").order("criado_em", { ascending: false }).range(de, ate);
        if (error) throw error;
        return res.json({ logs: data || [], total: count || 0, emailsVinculados: emails });
      }
      return res.status(400).json({ erro: "Modo desconhecido: " + modo });
    }

    if (action === "relatorio") {
      if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

      const { empresaId, nomeEmpresa, periodo = PERIODO_PADRAO } = req.body;

      const empresa = await resolverEmpresa(empresaId, nomeEmpresa);
      if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada" });

      const membros = await membrosDaEmpresa(empresa);
      const emails = membros.map((m: any) => m.email);
      const inicio = janelaDoPeriodo(periodo);
      const fim = new Date();

      // Teto alto o bastante para a agregação refletir o período inteiro na
      // prática, mas finito para a resposta não estourar o limite da função.
      // Quando o total ultrapassa o teto, o PDF avisa que houve corte.
      const TETO_EVENTOS = 5000;
      const TETO_ACOES_ADM = 300;

      let consultaEventos = supabaseAdmin
        .from("logs_acesso")
        .select("email, tipo_evento, criado_em, detalhes", { count: "exact" })
        .not("tipo_evento", "like", "adm_%")
        .order("criado_em", { ascending: false })
        .limit(TETO_EVENTOS);
      if (inicio) consultaEventos = consultaEventos.gte("criado_em", inicio.toISOString());

      let consultaAcoesAdm = supabaseAdmin
        .from("logs_acesso")
        .select("tipo_evento, criado_em, detalhes, executor_adm_email", { count: "exact" })
        .like("tipo_evento", "adm_%")
        .eq("empresa_id", empresa.id)
        .order("criado_em", { ascending: false })
        .limit(TETO_ACOES_ADM);
      if (inicio) consultaAcoesAdm = consultaAcoesAdm.gte("criado_em", inicio.toISOString());

      let consultaSolicitacoes = supabaseAdmin
        .from("solicitacoes_busca")
        .select("usuario_id, criado_em, cnaes, cidade, modalidade, status")
        .eq("empresa_id", empresa.id)
        .order("criado_em", { ascending: false })
        .limit(500);
      if (inicio) consultaSolicitacoes = consultaSolicitacoes.gte("criado_em", inicio.toISOString());

      const [eventosResp, acoesAdmResp, solicitacoesResp] = await Promise.all([
        emails.length > 0
          ? consultaEventos.in("email", emails)
          : Promise.resolve({ data: [], count: 0, error: null } as any),
        consultaAcoesAdm,
        consultaSolicitacoes,
      ]);

      if (eventosResp.error) throw eventosResp.error;
      if (acoesAdmResp.error) throw acoesAdmResp.error;
      if (solicitacoesResp.error) throw solicitacoesResp.error;

      const eventos = eventosResp.data || [];
      const solicitacoes = solicitacoesResp.data || [];
      const usuarios = agregarUsuarios(membros, eventos, solicitacoes);

      return res.json({
        empresa,
        periodo: {
          chave: periodo,
          inicio: inicio ? inicio.toISOString() : null,
          fim: fim.toISOString(),
        },
        resumo: resumirPeriodo(usuarios, solicitacoes),
        usuarios,
        serieAcessos: serieAcessos(eventos, inicio || new Date(empresa.created_at || fim), fim),
        solicitacoes: montarLinhasSolicitacoes(solicitacoes, membros),
        // O apêndice do PDF não precisa das 5000 linhas usadas na agregação.
        eventos: eventos.slice(0, 500),
        acoesAdm: acoesAdmResp.data || [],
        totalEventos: eventosResp.count ?? eventos.length,
        eventosTruncados: (eventosResp.count ?? 0) > eventos.length,
      });
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

