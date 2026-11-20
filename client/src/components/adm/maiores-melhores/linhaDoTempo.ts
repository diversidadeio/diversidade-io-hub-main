/**
 * linhaDoTempo.ts
 *
 * Monta a linha do tempo de uma empresa inscrita no Maiores & Melhores a partir dos dados que o
 * painel já carrega: inscrição, notas registradas, respostas dos compradores, links vencidos e
 * revisões da administração.
 *
 * O banco guarda só a situação atual de cada nota (não há histórico de revisões): se uma revisão
 * foi refeita, aparece apenas a mais recente.
 */
import {
  CATEGORIAS,
  type MmEmpresa,
  type MmNegocio,
  type MmParticipante,
  formatarData,
  formatarMoeda,
} from "@/lib/maioresMelhores";

export type TipoEvento =
  | "inscricao"
  | "registro"
  | "confirmado"
  | "divergencia"
  | "desconhecido"
  | "vencido"
  | "validado"
  | "indeferido"
  | "reaberto";

export interface EventoLinhaDoTempo {
  id: string;
  /** Data e hora (ISO) em que o evento aconteceu. */
  quando: string;
  tipo: TipoEvento;
  titulo: string;
  detalhe: string;
  negocioId?: string;
}

/** Em eventos no mesmo instante, a etapa mais avançada aparece primeiro. */
const ETAPA: Record<TipoEvento, number> = {
  inscricao: 0,
  registro: 1,
  vencido: 2,
  confirmado: 2,
  divergencia: 2,
  desconhecido: 2,
  validado: 3,
  indeferido: 3,
  reaberto: 3,
};

const nomeDaNota = (n: Pick<MmNegocio, "numero_nota" | "serie_nota">) =>
  `nota ${n.numero_nota}${n.serie_nota ? ` · série ${n.serie_nota}` : ""}`;

const maiuscula = (s: string) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);

/** Eventos da empresa, do mais recente para o mais antigo. */
export function montarLinhaDoTempo(
  empresa: MmEmpresa,
  negocios: MmNegocio[],
  participante?: Pick<MmParticipante, "nome"> | null,
  agora = Date.now(),
): EventoLinhaDoTempo[] {
  const eventos: EventoLinhaDoTempo[] = [
    {
      id: `inscricao-${empresa.id}`,
      quando: empresa.criado_em,
      tipo: "inscricao",
      titulo: "Inscrição realizada",
      detalhe: `${participante?.nome ? `${participante.nome} inscreveu a empresa` : "Empresa inscrita"} na categoria ${CATEGORIAS[empresa.categoria]} (${empresa.porte}).`,
    },
  ];

  for (const n of negocios) {
    if (n.empresa_id !== empresa.id) continue;
    const nota = nomeDaNota(n);
    const vendeu = n.cnpj_vendedor === empresa.cnpj;

    eventos.push({
      id: `registro-${n.id}`,
      quando: n.criado_em,
      tipo: "registro",
      titulo: `${maiuscula(nota)} registrada`,
      detalhe:
        `${vendeu ? "Venda para" : "Compra de"} ${n.razao_social_parceiro} · ${formatarMoeda(n.valor_centavos)} · ` +
        `emitida em ${formatarData(n.data_emissao)}. Confirmação pedida a ${n.email_comprador}.`,
      negocioId: n.id,
    });

    if (n.resposta_comprador && n.respondido_em) {
      const obs = n.observacao_comprador ? ` “${n.observacao_comprador}”` : "";
      const porResposta = {
        confirmado: { titulo: `Comprador confirmou a ${nota}`, detalhe: `Respondido por ${n.email_comprador}.` },
        divergencia: { titulo: `Comprador apontou divergência na ${nota}`, detalhe: `${n.email_comprador}:${obs || " sem descrição."}` },
        desconhecido: { titulo: `Comprador não reconheceu a ${nota}`, detalhe: `${n.email_comprador}${obs ? `:${obs}` : "."}` },
      }[n.resposta_comprador];
      eventos.push({ id: `resposta-${n.id}`, quando: n.respondido_em, tipo: n.resposta_comprador, ...porResposta, negocioId: n.id });
    } else if (!n.resposta_comprador && n.token_expira_em && Date.parse(n.token_expira_em) <= agora) {
      eventos.push({
        id: `vencido-${n.id}`,
        quando: n.token_expira_em,
        tipo: "vencido",
        titulo: `Link da ${nota} venceu sem resposta`,
        detalhe: `O comprador (${n.email_comprador}) não respondeu dentro do prazo. A empresa pode reenviar o e-mail.`,
        negocioId: n.id,
      });
    }

    if (n.revisado_em) {
      const por = n.revisado_por ? `Por ${n.revisado_por}.` : "";
      const porStatus = {
        validado: { tipo: "validado" as const, titulo: `${maiuscula(nota)} validada`, detalhe: `${por} Entra na apuração dos rankings.`.trim() },
        indeferido: { tipo: "indeferido" as const, titulo: `${maiuscula(nota)} indeferida`, detalhe: `${por}${n.motivo ? ` Motivo: ${n.motivo}` : ""}`.trim() },
        pendente: { tipo: "reaberto" as const, titulo: `${maiuscula(nota)} voltou para análise`, detalhe: por },
      }[n.status];
      eventos.push({ id: `revisao-${n.id}`, quando: n.revisado_em, ...porStatus, negocioId: n.id });
    }
  }

  return eventos.sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando) || ETAPA[b.tipo] - ETAPA[a.tipo]);
}

/** Agrupa por dia (fuso de São Paulo), mantendo a ordem dos eventos. */
export function agruparPorDia(eventos: EventoLinhaDoTempo[]) {
  const dia = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const grupos: { dia: string; eventos: EventoLinhaDoTempo[] }[] = [];
  for (const e of eventos) {
    const chave = dia.format(new Date(e.quando));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === chave) ultimo.eventos.push(e);
    else grupos.push({ dia: chave, eventos: [e] });
  }
  return grupos;
}
