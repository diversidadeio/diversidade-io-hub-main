export const ROTA_VOTACAO_MM = "/maiores-e-melhores/votacao";
export const ROTA_ACOMPANHAR_MM = ROTA_VOTACAO_MM + "/acompanhar";
export const TITULO_VOTACAO_MM = "Votação Mais Admirados";

export interface CategoriaVoto {
  id: string;
  nome: string;
  ativa: boolean;
  catalogo?: boolean;
}

export interface ConcorrenteVoto {
  id: string;
  categoria_id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  responsavel: string;
  descricao: string;
  cidade: string;
  uf: string;
  logo: string | null;
  foto: string | null;
  site: string | null;
  instagram: string | null;
  publicado: boolean;
}

export interface RankingVoto extends Pick<ConcorrenteVoto,
  "id" | "categoria_id" | "nome" | "descricao" | "cidade" | "uf" | "logo" | "foto" | "site" | "instagram"> {
  votos: number;
  posicao: number;
  percentual: number;
  razao_social?: string | null;
}

export interface ConfiguracaoVoto {
  inicio: string;
  fim: string;
  estado: "rascunho" | "ativa" | "suspensa" | "encerrada" | "publicada";
}

export const estadosVotacao: Record<ConfiguracaoVoto["estado"], string> = {
  rascunho: "Rascunho",
  ativa: "Ativa no período",
  suspensa: "Suspensa",
  encerrada: "Encerrada",
  publicada: "Resultado definitivo publicado",
};

export const dataVoto = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function horarioBrasilia(valor: string) {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
  return partes.replace(" ", "T");
}

export function urlPublica(valor: string | null) {
  if (!valor) return undefined;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const colacao = new Intl.Collator("pt-BR", { sensitivity: "base" });

export function ordenarRanking(linhas: RankingVoto[]) {
  return [...linhas].sort((a, b) => b.votos - a.votos || colacao.compare(a.nome, b.nome) || a.id.localeCompare(b.id));
}

export function filtrarRanking(linhas: RankingVoto[], busca: string, porSocio: readonly string[] = []) {
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const termo = normalizar(busca.trim());
  const identificadores = new Set(porSocio);
  return ordenarRanking(linhas.filter(({ id, nome, razao_social }) =>
    identificadores.has(id) || normalizar(nome).includes(termo) || normalizar(razao_social ?? "").includes(termo)));
}
