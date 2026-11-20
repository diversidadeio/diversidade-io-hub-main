import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, type LucideIcon, Send, TimerOff, XCircle } from "lucide-react";
import {
  PERFIS_PARCEIRO,
  STATUS_NEGOCIO,
  type MmEmpresa,
  type MmNegocio,
  type SituacaoComprador,
  type StatusNegocio,
  formatarCnpj,
  formatarData,
  formatarMoeda,
  situacaoConfirmacao,
  situacaoDoComprador,
} from "@/lib/maioresMelhores";
import { mascaraTelefone } from "@/lib/mascaras";
import { corStatus, mm } from "./estilo";

interface Props {
  negocios: MmNegocio[];
  empresas: MmEmpresa[];
  /** Participante: gera novo link de confirmação */
  aoRenovar?: (negocio: MmNegocio) => void;
  /** Administração: valida, indefere ou volta para análise */
  aoRevisar?: (negocio: MmNegocio, status: StatusNegocio, motivo: string) => void;
  /** Administração: o nome da empresa inscrita vira link para a ficha dela */
  aoAbrirEmpresa?: (empresa: MmEmpresa) => void;
  vazio?: string;
}

export function ListaNegocios({ negocios, empresas, aoRenovar, aoRevisar, aoAbrirEmpresa, vazio = "Nenhum negócio encontrado." }: Props) {
  const [indeferindo, setIndeferindo] = useState<string>();
  const [motivo, setMotivo] = useState("");

  if (!negocios.length) return <p className={mm.vazio}>{vazio}</p>;

  return (
    <div className="grid gap-3.5">
      {negocios.map((n) => {
        const empresa = empresas.find((e) => e.id === n.empresa_id);
        return (
          <article key={n.id} className={mm.cartao}>
            <div className="flex justify-between gap-2 items-start">
              <div className="min-w-0">
                <strong>{n.razao_social_parceiro}</strong>
                <p className="m-0 text-sm text-[#62566f]">
                  {empresa && aoAbrirEmpresa ? (
                    <button
                      type="button"
                      className="font-semibold text-[#5c2686] underline-offset-2 hover:underline cursor-pointer"
                      title="Abrir a ficha da empresa"
                      onClick={() => aoAbrirEmpresa(empresa)}
                    >
                      {empresa.razao_social}
                    </button>
                  ) : (
                    empresa?.razao_social
                  )}{" "}
                  · {PERFIS_PARCEIRO[n.perfil_parceiro]}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 whitespace-nowrap font-bold text-[0.85rem] ${corStatus[n.status]}`}>
                {STATUS_NEGOCIO[n.status]}
              </span>
            </div>

            <dl className="flex flex-wrap gap-x-6 gap-y-2 my-3">
              <Item rotulo="Compradora" valor={formatarCnpj(n.cnpj_comprador)} />
              <Item rotulo="Vendedora" valor={formatarCnpj(n.cnpj_vendedor)} />
              <Item rotulo="Emissão" valor={formatarData(n.data_emissao)} />
              <Item rotulo="Valor" valor={formatarMoeda(n.valor_centavos)} />
            </dl>

            <div className="grid gap-2.5">
              <strong>Nota {n.numero_nota}{n.serie_nota ? ` · Série ${n.serie_nota}` : ""}</strong>
              <RespostaDoComprador
                negocio={n}
                aoReenviar={aoRenovar && n.status === "pendente" && !n.resposta_comprador ? () => aoRenovar(n) : undefined}
              />
              {n.motivo && <p className={mm.dica}>Motivo do indeferimento: {n.motivo}</p>}
              {aoRevisar && n.revisado_por && (
                <p className={mm.dica}>Revisado por {n.revisado_por}{n.revisado_em ? ` em ${formatarData(n.revisado_em)}` : ""}</p>
              )}
            </div>

            {aoRevisar && (
              <div className={mm.acoes}>
                {n.status !== "validado" && n.resposta_comprador === "confirmado" && (
                  <button type="button" className={mm.botaoSecundario} onClick={() => aoRevisar(n, "validado", "")}>
                    Validar negócio
                  </button>
                )}
                {n.status !== "indeferido" && (
                  <button
                    type="button"
                    className={mm.botaoSecundario}
                    onClick={() => {
                      setIndeferindo(n.id);
                      setMotivo("");
                    }}
                  >
                    Indeferir
                  </button>
                )}
                {n.status !== "pendente" && (
                  <button type="button" className={mm.botaoSecundario} onClick={() => aoRevisar(n, "pendente", "")}>
                    Voltar para análise
                  </button>
                )}
              </div>
            )}

            {aoRevisar && indeferindo === n.id && n.status !== "indeferido" && (
              <form
                className="mt-3 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  aoRevisar(n, "indeferido", motivo);
                  setIndeferindo(undefined);
                }}
              >
                <label className={mm.rotulo}>
                  Motivo do indeferimento
                  <input required maxLength={350} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={mm.campo} />
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button className={mm.botao}>Confirmar indeferimento</button>
                  <button className={mm.botaoSecundario} type="button" onClick={() => setIndeferindo(undefined)}>Cancelar</button>
                </div>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}

const VISUAL_COMPRADOR: Record<SituacaoComprador, { Icone: LucideIcon; classes: string }> = {
  confirmado: { Icone: CheckCircle2, classes: "bg-[#e3f3e8] border-[#b7dcc3] text-[#205c39]" },
  divergencia: { Icone: AlertTriangle, classes: "bg-[#fdf1e3] border-[#f0cf9f] text-[#7a3f0c]" },
  desconhecido: { Icone: XCircle, classes: "bg-[#fbe8ee] border-[#efc0ce] text-[#84243f]" },
  vencido: { Icone: TimerOff, classes: "bg-[#f1f0f3] border-[#dcd8e1] text-[#4b4357]" },
  aguardando: { Icone: Clock, classes: "bg-[#f5f0f8] border-[#e2d5ec] text-[#5c2686]" },
};

/**
 * Destaque com a resposta do comprador: aprovou, apontou divergência, não reconheceu ou ainda não respondeu.
 * Enquanto não há resposta, o participante pode pedir que a plataforma reenvie o e-mail (`aoReenviar`).
 */
function RespostaDoComprador({ negocio: n, aoReenviar }: { negocio: MmNegocio; aoReenviar?: () => void }) {
  const situacao = situacaoDoComprador(n);
  const { Icone, classes } = VISUAL_COMPRADOR[situacao];
  const whatsapp = n.whatsapp_comprador ? ` · WhatsApp ${mascaraTelefone(n.whatsapp_comprador)}` : "";
  const detalhe =
    situacao === "aguardando"
      ? `Confirmação pedida a ${n.email_comprador}${whatsapp}.${n.token_expira_em ? ` Link vale até ${formatarData(n.token_expira_em)}.` : ""}`
      : situacao === "vencido"
        ? `O link enviado para ${n.email_comprador} venceu sem resposta${n.token_expira_em ? ` em ${formatarData(n.token_expira_em)}` : ""}.`
        : `Respondido por ${n.email_comprador}${n.respondido_em ? ` em ${formatarData(n.respondido_em)}` : ""}.`;

  return (
    <div className={`flex gap-2.5 items-start rounded-lg border px-3.5 py-3 ${classes}`}>
      <Icone size={20} className="flex-none mt-px" aria-hidden="true" />
      <div className="min-w-0 grid gap-0.5">
        <p className="m-0 text-[0.8rem] uppercase tracking-[0.06em] font-bold opacity-80">Resposta do comprador</p>
        <p className="m-0 font-bold">{situacaoConfirmacao(n)}</p>
        <p className="m-0 text-sm opacity-90">{detalhe}</p>
        {n.observacao_comprador && <p className="m-0 text-sm">Observação do comprador: “{n.observacao_comprador}”</p>}
        {aoReenviar && (
          <div className="mt-2.5 grid gap-2 justify-items-start">
            <p className="m-0 text-sm text-[#4b4357]">
              {situacao === "vencido"
                ? "Reenvie para o comprador receber um novo link, válido por 7 dias."
                : "O comprador não recebeu? Peça para conferir a caixa de spam ou reenvie. O link anterior deixa de valer."}
            </p>
            <button type="button" className={situacao === "vencido" ? mm.botao : mm.botaoSecundario} onClick={aoReenviar}>
              <Send size={16} aria-hidden="true" /> Reenviar e-mail ao comprador
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[0.85rem] text-[#62566f]">{rotulo}</dt>
      <dd className="m-0 font-semibold">{valor}</dd>
    </div>
  );
}
