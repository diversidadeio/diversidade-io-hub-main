export interface CategoriaVoto {
  id: string;
  nome: string;
  ativa: boolean;
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

export function ordenarRanking(linhas: RankingVoto[]) {
  return [...linhas].sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome, "pt-BR"));
}
