/**
 * Formatadores de exibição do Relatório de Auditoria em PDF.
 *
 * Separados de `relatorioEmpresaPdf.ts` porque aquele módulo carrega o jsPDF,
 * que espera um DOM — aqui fica só texto e cor, testável em Node.
 */

const FUSO_BRASILIA = "America/Sao_Paulo";
const SEM_VALOR = "—";

/** Cor RGB no formato que o jsPDF consome. */
export type CorRgb = [number, number, number];

export type RotuloStatus = { texto: string; cor: CorRgb };

const VERDE: CorRgb = [22, 137, 88];
const AMBAR: CorRgb = [180, 108, 12];
const AZUL: CorRgb = [37, 99, 235];
const VERMELHO: CorRgb = [190, 46, 46];
const CINZA: CorRgb = [107, 114, 128];

function formatarComFuso(iso: string | null | undefined, opcoes: Intl.DateTimeFormatOptions): string {
  if (!iso) return SEM_VALOR;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return SEM_VALOR;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_BRASILIA, ...opcoes })
    .format(data)
    .replace(",", "");
}

/**
 * Data e hora no fuso de Brasília.
 *
 * O banco grava em UTC e a Vercel roda com TZ=UTC: sem converter, um acesso às
 * 23h30 apareceria como 02h30 do dia seguinte.
 */
export function formatarDataHoraBrasilia(iso: string | null | undefined): string {
  return formatarComFuso(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Só o dia, para cabeçalhos de período. */
export function formatarDataBrasilia(iso: string | null | undefined): string {
  return formatarComFuso(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatarNumero(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("pt-BR");
}

const STATUS_SOLICITACAO: Record<string, RotuloStatus> = {
  pendente: { texto: "Pendente", cor: AMBAR },
  em_andamento: { texto: "Em andamento", cor: AZUL },
  concluido: { texto: "Concluído", cor: VERDE },
  cancelado: { texto: "Cancelado", cor: CINZA },
};

/**
 * `solicitacoes_busca.status` perdeu a constraint CHECK, então um valor novo
 * aparece no relatório como veio, em vez de sumir da tabela.
 */
export function rotuloStatusSolicitacao(status: string | null | undefined): RotuloStatus {
  if (!status) return { texto: SEM_VALOR, cor: CINZA };
  return STATUS_SOLICITACAO[status] || { texto: status, cor: CINZA };
}

const STATUS_APROVACAO: Record<string, RotuloStatus> = {
  aprovado: { texto: "Aprovado", cor: VERDE },
  pendente: { texto: "Pendente", cor: AMBAR },
  rejeitado: { texto: "Rejeitado", cor: VERMELHO },
  suspenso: { texto: "Suspenso", cor: VERMELHO },
};

export function rotuloStatusAprovacao(status: string | null | undefined): RotuloStatus {
  if (!status) return { texto: "Não informado", cor: CINZA };
  return STATUS_APROVACAO[status] || { texto: status, cor: CINZA };
}
