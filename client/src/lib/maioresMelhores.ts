/**
 * maioresMelhores.ts
 *
 * Tipos, rótulos e regras puras do módulo "Maiores & Melhores no
 * Empreendedorismo Negro". As mesmas regras são aplicadas no banco pelas RPCs
 * da migration 34 — aqui elas servem para feedback imediato no formulário e
 * para a apuração exibida no painel administrativo.
 */

export type Categoria = "afro" | "inclusiva";
export type PerfilParceiro = "afro" | "media" | "grande";
export type StatusNegocio = "pendente" | "validado" | "indeferido";
export type Declaracao = "preta_parda" | "outra" | "nao_informada";
export type RespostaComprador = "confirmado" | "divergencia" | "desconhecido";
export type Porte = "MEI" | "Micro" | "Pequena" | "Média" | "Grande";

export const CATEGORIAS: Record<Categoria, string> = {
  afro: "Afroempreendedores",
  inclusiva: "Empresas inclusivas",
};

export const PERFIS_PARCEIRO: Record<PerfilParceiro, string> = {
  afro: "Liderada por pessoas negras",
  media: "Média empresa inclusiva",
  grande: "Grande empresa inclusiva",
};

export const STATUS_NEGOCIO: Record<StatusNegocio, string> = {
  pendente: "Em análise",
  validado: "Validado",
  indeferido: "Indeferido",
};

export const DECLARACOES: Record<Declaracao, string> = {
  preta_parda: "Preta ou parda",
  outra: "Outra autodeclaração",
  nao_informada: "Não informada",
};

export const RESPOSTAS_COMPRADOR: Record<RespostaComprador, string> = {
  confirmado: "Aprovado pelo comprador",
  divergencia: "Comprador informou divergência",
  desconhecido: "Comprador não reconheceu a operação",
};

export const PORTES: Porte[] = ["MEI", "Micro", "Pequena", "Média", "Grande"];
export const PORTES_INCLUSIVA: Porte[] = ["Média", "Grande"];

export const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export interface MmEvento {
  id: string;
  ano: number;
  titulo: string;
  descricao: string | null;
  inicio_cadastro: string;
  fim_cadastro: string;
  ativo?: boolean;
  aberto?: boolean;
  criado_em?: string;
}

export interface MmSocio {
  nome: string;
  declaracao: Declaracao;
  /** Caminho da foto no bucket privado. Só a administração recebe este campo. */
  foto_path?: string | null;
  foto_autorizada?: boolean;
  /** Na sessão do participante o caminho não vem: só a informação de que existe foto... */
  tem_foto?: boolean;
  /** ...e um identificador opaco dela, usado para mantê-la ao editar a inscrição. */
  foto_id?: string | null;
}

export interface MmEmpresa {
  id: string;
  evento_id: string;
  participante_id?: string;
  categoria: Categoria;
  porte: Porte;
  razao_social: string;
  cnpj: string;
  responsavel: string;
  email: string;
  municipio: string;
  uf: string;
  /** Na categoria afro, o primeiro item é o responsável pela inscrição. */
  socios: MmSocio[];
  criado_em: string;
}

export interface MmNegocio {
  id: string;
  evento_id: string;
  empresa_id: string;
  perfil_parceiro: PerfilParceiro;
  cnpj_comprador: string;
  cnpj_vendedor: string;
  cnpj_parceiro: string;
  razao_social_parceiro: string;
  data_emissao: string;
  valor_centavos: number;
  numero_nota: string;
  serie_nota: string;
  email_comprador: string;
  whatsapp_comprador: string | null;
  token_expira_em: string | null;
  resposta_comprador: RespostaComprador | null;
  observacao_comprador: string | null;
  respondido_em: string | null;
  status: StatusNegocio;
  motivo: string;
  revisado_por?: string | null;
  revisado_em?: string | null;
  criado_em: string;
}

export interface MmParticipante {
  id: string;
  evento_id: string | null;
  nome: string;
  email: string;
  telefone: string;
  criado_em: string;
}

// ───────────────────────────────────────────────────────────────────────────
// CNPJ (numérico e alfanumérico)
// ───────────────────────────────────────────────────────────────────────────

export const normalizarCnpj = (bruto: string) => bruto.replace(/[./\s-]/g, "").toUpperCase();

export function formatarCnpj(bruto: string) {
  const s = normalizarCnpj(bruto);
  return /^[A-Z0-9]{12}\d{2}$/.test(s)
    ? s.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5")
    : bruto;
}

export function cnpjValido(bruto: string) {
  const s = normalizarCnpj(bruto);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(s) || /^(.)\1+$/.test(s)) return false;
  const digito = (tamanho: number) => {
    const soma = [...s.slice(0, tamanho)].reduce(
      (total, ch, i) => total + (ch.charCodeAt(0) - 48) * (((tamanho - i - 1) % 8) + 2),
      0,
    );
    return soma % 11 < 2 ? 0 : 11 - (soma % 11);
  };
  return digito(12) === Number(s[12]) && digito(13) === Number(s[13]);
}

// ───────────────────────────────────────────────────────────────────────────
// Valores e datas
// ───────────────────────────────────────────────────────────────────────────

/** "25.000,00", "1500,5" ou "1500.50" → centavos. Retorna NaN se inválido. */
export function converterValorEmCentavos(bruto: string) {
  const s = bruto.trim().replace(/^R\$\s*/i, "").replace(/^(\d+)\.(\d{1,2})$/, "$1,$2");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)) return NaN;
  const [inteiro, fracao = ""] = s.replace(/\./g, "").split(",");
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
}

export const formatarMoeda = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

/** "2026-03-09" ou ISO completo → "09/03/2026" */
export const formatarData = (valor: string | null | undefined) =>
  valor ? valor.slice(0, 10).split("-").reverse().join("/") : "";

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo */
export const hojeSaoPaulo = (agora = new Date()) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);

/** Caminhos das fotos enviadas pelos sócios (só a administração recebe os caminhos). */
export const fotosDaEmpresa = (empresa: Pick<MmEmpresa, "socios">) =>
  empresa.socios.map((s) => s.foto_path).filter((caminho): caminho is string => !!caminho);

export type SituacaoPeriodo = "agendado" | "aberto" | "encerrado";

export function situacaoPeriodo(evento: Pick<MmEvento, "inicio_cadastro" | "fim_cadastro">, hoje = hojeSaoPaulo()): SituacaoPeriodo {
  if (hoje < evento.inicio_cadastro) return "agendado";
  if (hoje > evento.fim_cadastro) return "encerrado";
  return "aberto";
}

// ───────────────────────────────────────────────────────────────────────────
// Papel da empresa inscrita no negócio
// ───────────────────────────────────────────────────────────────────────────

/**
 * Empresas inclusivas sempre compram de empresas lideradas por pessoas negras.
 * Afroempreendedores vendem para empresas inclusivas e, entre si, podem comprar ou vender.
 */
export function papelDaInscrita(categoria: Categoria, perfil: PerfilParceiro, escolhido: "comprador" | "vendedor") {
  if (categoria === "inclusiva") return "comprador" as const;
  if (perfil !== "afro") return "vendedor" as const;
  return escolhido;
}

export function perfisPermitidos(categoria: Categoria): PerfilParceiro[] {
  return categoria === "inclusiva" ? ["afro"] : ["afro", "media", "grande"];
}

// ───────────────────────────────────────────────────────────────────────────
// Apuração
// ───────────────────────────────────────────────────────────────────────────

export type MetricaRanking = "parceiros" | "valor";

export interface LinhaRanking {
  posicao: number;
  empresaId: string;
  razaoSocial: string;
  pontuacao: number;
}

export interface Ranking {
  categoria: Categoria;
  metrica: MetricaRanking;
  /** Presente nos rankings recortados pelo perfil da empresa parceira. */
  perfil?: PerfilParceiro;
  linhas: LinhaRanking[];
}

/**
 * Somente negócios validados entram na apuração. Cada CNPJ parceiro conta uma
 * vez por empresa. Empates compartilham a posição.
 */
export function calcularRankings(empresas: MmEmpresa[], negocios: MmNegocio[]): Ranking[] {
  const totais = new Map<string, { parceiros: Set<string>; valor: number }>();
  for (const n of negocios) {
    if (n.status !== "validado") continue;
    const item = totais.get(n.empresa_id) ?? { parceiros: new Set<string>(), valor: 0 };
    item.parceiros.add(n.cnpj_parceiro);
    item.valor += n.valor_centavos;
    totais.set(n.empresa_id, item);
  }

  const rankings: Ranking[] = [];
  for (const categoria of Object.keys(CATEGORIAS) as Categoria[]) {
    for (const metrica of ["parceiros", "valor"] as MetricaRanking[]) {
      const ordenadas = empresas
        .filter((e) => e.categoria === categoria && totais.has(e.id))
        .map((e) => {
          const t = totais.get(e.id)!;
          return { empresaId: e.id, razaoSocial: e.razao_social, pontuacao: metrica === "parceiros" ? t.parceiros.size : t.valor };
        })
        .sort((a, b) => b.pontuacao - a.pontuacao || a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"));

      let posicao = 1;
      const linhas = ordenadas.map((linha, i) => {
        if (i > 0 && linha.pontuacao !== ordenadas[i - 1].pontuacao) posicao = i + 1;
        return { ...linha, posicao };
      });
      rankings.push({ categoria, metrica, linhas });
    }
  }
  return rankings;
}

/**
 * Rankings dos Afroempreendedores recortados pelo perfil da parceira (liderada por pessoas negras,
 * média inclusiva, grande inclusiva), com as mesmas regras de `calcularRankings`. Empresas inclusivas
 * ficam de fora: só negociam com empresas lideradas por pessoas negras, então o recorte repetiria o
 * ranking geral delas.
 */
export function calcularRankingsPorPerfil(empresas: MmEmpresa[], negocios: MmNegocio[]): Ranking[] {
  const afro = empresas.filter((e) => e.categoria === "afro");
  return perfisPermitidos("afro").flatMap((perfil) =>
    calcularRankings(afro, negocios.filter((n) => n.perfil_parceiro === perfil))
      .filter((r) => r.categoria === "afro")
      .map((r) => ({ ...r, perfil })),
  );
}

/** Soma dos negócios validados contando cada nota (vendedor + série + número) uma única vez. */
export function valorValidadoSemDuplicar(negocios: MmNegocio[]) {
  const notas = new Map<string, number>();
  for (const n of negocios) {
    if (n.status !== "validado") continue;
    notas.set(JSON.stringify([n.cnpj_vendedor, n.serie_nota, n.numero_nota]), n.valor_centavos);
  }
  let total = 0;
  for (const v of notas.values()) total += v;
  return total;
}

/** Texto de acompanhamento da confirmação do comprador. */
/** Em que pé está a resposta do comprador: a resposta dada, link vencido sem resposta, ou aguardando. */
export type SituacaoComprador = RespostaComprador | "vencido" | "aguardando";

export function situacaoDoComprador(n: Pick<MmNegocio, "resposta_comprador" | "token_expira_em">, agora = Date.now()): SituacaoComprador {
  if (n.resposta_comprador) return n.resposta_comprador;
  if (n.token_expira_em && Date.parse(n.token_expira_em) <= agora) return "vencido";
  return "aguardando";
}

export function situacaoConfirmacao(n: Pick<MmNegocio, "resposta_comprador" | "token_expira_em">, agora = Date.now()) {
  const situacao = situacaoDoComprador(n, agora);
  if (situacao === "vencido") return "Link de confirmação vencido";
  if (situacao === "aguardando") return "Aguardando confirmação do comprador";
  return RESPOSTAS_COMPRADOR[situacao];
}
