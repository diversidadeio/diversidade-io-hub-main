/**
 * Funcoes puras que montam o Relatorio de Auditoria por Empresa.
 *
 * Sem I/O de proposito: `api/logs.ts` faz as consultas ao Supabase e passa as
 * linhas cruas para ca, o que deixa a agregacao coberta por testes de unidade
 * (tests/relatorio-empresa.test.ts).
 *
 * Mora em `api/` com prefixo `_` (mesmo padrao de `_auth.ts`): a Vercel nao
 * transforma esses arquivos em rotas, e o import relativo continua dentro da
 * pasta que o runtime serverless publica.
 */

/** Janelas oferecidas no seletor do relatorio. */
export const PERIODO_PADRAO = "90d";

/**
 * Instante inicial do periodo. `null` significa "sem corte" (todo o historico).
 * Periodo desconhecido cai no padrao em vez de virar relatorio vazio.
 */
export function janelaDoPeriodo(periodo: string | undefined, agora: Date = new Date()): Date | null {
  const escolhido = periodo || PERIODO_PADRAO;
  if (escolhido === "tudo") return null;

  const inicio = new Date(agora.getTime());
  if (escolhido === "30d") {
    inicio.setDate(inicio.getDate() - 30);
    return inicio;
  }
  if (escolhido === "12m") {
    inicio.setFullYear(inicio.getFullYear() - 1);
    return inicio;
  }
  inicio.setDate(inicio.getDate() - 90);
  return inicio;
}

const FUSO_BRASILIA = "America/Sao_Paulo";

export type MembroEmpresa = {
  id?: string | null;
  auth_user_id?: string | null;
  nome?: string | null;
  email?: string | null;
  papel?: string | null;
};

export type LogAcesso = {
  email?: string | null;
  tipo_evento?: string | null;
  criado_em?: string | null;
  detalhes?: string | null;
  nome_empresa?: string | null;
};

export type SolicitacaoBusca = {
  usuario_id?: string | null;
  criado_em?: string | null;
  cidade?: string | null;
  modalidade?: string | null;
  status?: string | null;
  cnaes?: string[] | null;
};

export type LinhaUsuario = {
  nome: string;
  email: string;
  papel: string;
  ultimoAcesso: string | null;
  totalLogins: number;
  totalFalhas: number;
  totalAcoes: number;
  totalSolicitacoes: number;
  ativo: boolean;
};

const chaveEmail = (email: string | null | undefined) => (email || "").trim().toLowerCase();

/**
 * Uma linha por membro da empresa — inclusive quem nunca acessou, que e
 * justamente a informacao que o relatorio precisa evidenciar. Logs de e-mails
 * de fora da empresa sao descartados: a consulta ja filtra por e-mail, mas o
 * relatorio nao pode creditar acesso a quem nao esta na lista.
 */
export function agregarUsuarios(
  membros: MembroEmpresa[],
  logs: LogAcesso[] = [],
  solicitacoes: SolicitacaoBusca[] = [],
): LinhaUsuario[] {
  const linhas = new Map<string, LinhaUsuario>();

  for (const membro of membros || []) {
    const email = chaveEmail(membro.email);
    if (!email || linhas.has(email)) continue;
    linhas.set(email, {
      nome: membro.nome || "—",
      email,
      papel: membro.papel || "usuario",
      ultimoAcesso: null,
      totalLogins: 0,
      totalFalhas: 0,
      totalAcoes: 0,
      totalSolicitacoes: 0,
      ativo: false,
    });
  }

  for (const evento of logs || []) {
    const linha = linhas.get(chaveEmail(evento.email));
    if (!linha) continue;

    linha.totalAcoes += 1;
    if (evento.tipo_evento === "login_falha") {
      linha.totalFalhas += 1;
      continue;
    }
    if (evento.tipo_evento === "login_sucesso") {
      linha.totalLogins += 1;
      linha.ativo = true;
      if (
        evento.criado_em &&
        (!linha.ultimoAcesso || new Date(evento.criado_em) > new Date(linha.ultimoAcesso))
      ) {
        linha.ultimoAcesso = evento.criado_em;
      }
    }
  }

  // `solicitacoes_busca.usuario_id` guarda o auth_user_id de quem abriu o
  // pedido — nao o responsavel do cadastro. Ver tests/resolver-solicitante.
  const porIdentificador = new Map<string, LinhaUsuario>();
  for (const membro of membros || []) {
    const linha = linhas.get(chaveEmail(membro.email));
    if (!linha) continue;
    if (membro.auth_user_id) porIdentificador.set(membro.auth_user_id, linha);
    if (membro.id) porIdentificador.set(membro.id, linha);
  }
  for (const solicitacao of solicitacoes || []) {
    const linha = solicitacao.usuario_id ? porIdentificador.get(solicitacao.usuario_id) : undefined;
    if (linha) linha.totalSolicitacoes += 1;
  }

  return [...linhas.values()].sort((a, b) => {
    if (a.ultimoAcesso && b.ultimoAcesso) {
      return new Date(b.ultimoAcesso).getTime() - new Date(a.ultimoAcesso).getTime();
    }
    if (a.ultimoAcesso) return -1;
    if (b.ultimoAcesso) return 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export type ResumoRelatorio = {
  totalUsuarios: number;
  usuariosAtivos: number;
  usuariosSemAcesso: number;
  totalAcessos: number;
  totalFalhas: number;
  ultimoAcesso: string | null;
  totalSolicitacoes: number;
  solicitacoesPorStatus: Record<string, number>;
};

/** Numeros da capa do relatorio, derivados das linhas ja agregadas por usuario. */
export function resumirPeriodo(
  usuarios: LinhaUsuario[],
  solicitacoes: SolicitacaoBusca[] = [],
): ResumoRelatorio {
  const solicitacoesPorStatus: Record<string, number> = {};
  for (const solicitacao of solicitacoes || []) {
    const status = solicitacao.status || "desconhecido";
    solicitacoesPorStatus[status] = (solicitacoesPorStatus[status] || 0) + 1;
  }

  let ultimoAcesso: string | null = null;
  for (const usuario of usuarios) {
    if (usuario.ultimoAcesso && (!ultimoAcesso || new Date(usuario.ultimoAcesso) > new Date(ultimoAcesso))) {
      ultimoAcesso = usuario.ultimoAcesso;
    }
  }

  const usuariosAtivos = usuarios.filter((u) => u.ativo).length;

  return {
    totalUsuarios: usuarios.length,
    usuariosAtivos,
    usuariosSemAcesso: usuarios.length - usuariosAtivos,
    totalAcessos: usuarios.reduce((soma, u) => soma + u.totalLogins, 0),
    totalFalhas: usuarios.reduce((soma, u) => soma + u.totalFalhas, 0),
    ultimoAcesso,
    totalSolicitacoes: (solicitacoes || []).length,
    solicitacoesPorStatus,
  };
}

const MESES_ABREVIADOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Chave "AAAA-MM-DD" no fuso de Brasilia (a Vercel roda em UTC). */
function diaBrasilia(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASILIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

/** Meio-dia evita qualquer ambiguidade de borda ao andar de dia em dia. */
function somarDias(chaveDia: string, dias: number): string {
  const data = new Date(`${chaveDia}T12:00:00-03:00`);
  data.setDate(data.getDate() + dias);
  return diaBrasilia(data);
}

export type PontoSerie = { rotulo: string; total: number };

/**
 * Serie de logins bem-sucedidos para o grafico do relatorio. Periodos de ate
 * dois meses saem dia a dia; acima disso, mes a mes, senao o eixo viraria uma
 * mancha de 365 barras. Os intervalos sem acesso aparecem com zero — a ausencia
 * de uso e exatamente o que o relatorio precisa mostrar.
 */
export function serieAcessos(logs: LogAcesso[], inicio: Date, fim: Date): PontoSerie[] {
  const diaInicial = diaBrasilia(inicio);
  const diaFinal = diaBrasilia(fim);
  const vaoEmDias = Math.round(
    (new Date(`${diaFinal}T12:00:00-03:00`).getTime() - new Date(`${diaInicial}T12:00:00-03:00`).getTime()) /
      86_400_000,
  );
  const porMes = vaoEmDias > 62;

  const baldes = new Map<string, number>();
  for (let dia = diaInicial; ; dia = somarDias(dia, 1)) {
    baldes.set(porMes ? dia.slice(0, 7) : dia, 0);
    if (dia >= diaFinal) break;
  }

  for (const evento of logs || []) {
    if (evento.tipo_evento !== "login_sucesso" || !evento.criado_em) continue;
    const dia = diaBrasilia(new Date(evento.criado_em));
    const chave = porMes ? dia.slice(0, 7) : dia;
    if (baldes.has(chave)) baldes.set(chave, (baldes.get(chave) || 0) + 1);
  }

  return [...baldes.entries()].map(([chave, total]) => {
    const [ano, mes, dia] = chave.split("-");
    return {
      rotulo: porMes ? `${MESES_ABREVIADOS[Number(mes) - 1]}/${ano.slice(2)}` : `${dia}/${mes}`,
      total,
    };
  });
}

export type LinhaSolicitacao = {
  criadoEm: string | null;
  cnaes: string;
  cidade: string;
  modalidade: string;
  status: string;
  autorNome: string;
  autorEmail: string;
};

/**
 * Uma linha por solicitacao de busca, com o autor real resolvido.
 *
 * `solicitacoes_busca.usuario_id` guarda o auth_user_id do membro que abriu o
 * pedido; mostrar `empresas.email` no lugar faria o relatorio divergir do log
 * de auditoria, que grava o autor a partir do token JWT.
 */
export function montarLinhasSolicitacoes(
  solicitacoes: SolicitacaoBusca[],
  membros: MembroEmpresa[],
): LinhaSolicitacao[] {
  const porIdentificador = new Map<string, MembroEmpresa>();
  for (const membro of membros || []) {
    if (membro.auth_user_id) porIdentificador.set(membro.auth_user_id, membro);
    if (membro.id) porIdentificador.set(membro.id, membro);
  }

  return [...(solicitacoes || [])]
    .sort((a, b) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime())
    .map((solicitacao) => {
      const autor = solicitacao.usuario_id ? porIdentificador.get(solicitacao.usuario_id) : undefined;
      return {
        criadoEm: solicitacao.criado_em || null,
        cnaes: (solicitacao.cnaes || []).join(", ") || "—",
        cidade: solicitacao.cidade || "—",
        modalidade: solicitacao.modalidade || "—",
        status: solicitacao.status || "—",
        autorNome: autor?.nome || "—",
        autorEmail: autor?.email || "—",
      };
    });
}
