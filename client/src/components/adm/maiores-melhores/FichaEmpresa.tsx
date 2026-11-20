/**
 * Ficha da empresa inscrita no painel do Maiores & Melhores: números, linha do tempo, negócios
 * (com validação e indeferimento) e dados da inscrição, num painel lateral.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  FileText,
  type LucideIcon,
  RotateCcw,
  TimerOff,
  Trash2,
  XCircle,
} from "lucide-react";
import { ListaNegocios } from "@/components/maiores-melhores/ListaNegocios";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mascaraTelefone } from "@/lib/mascaras";
import {
  CATEGORIAS,
  DECLARACOES,
  type MmEmpresa,
  type MmNegocio,
  type MmParticipante,
  type StatusNegocio,
  formatarCnpj,
  formatarData,
  formatarMoeda,
  fotosDaEmpresa,
} from "@/lib/maioresMelhores";
import { Avatar, useFotosAssinadas } from "./AvatarSocio";
import { type TipoEvento, agruparPorDia, montarLinhaDoTempo } from "./linhaDoTempo";

interface Props {
  /** Empresa aberta; undefined fecha o painel. */
  empresa?: MmEmpresa;
  empresas: MmEmpresa[];
  negocios: MmNegocio[];
  participante?: MmParticipante;
  aoFechar: () => void;
  revisar: (n: MmNegocio, status: StatusNegocio, motivo: string) => Promise<void>;
  verNaAbaNegocios: (e: MmEmpresa) => void;
  excluir: (e: MmEmpresa) => void;
}

export function FichaEmpresa({ empresa, aoFechar, ...resto }: Props) {
  return (
    <Sheet open={!!empresa} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 gap-0 overflow-y-auto">
        {empresa && <Conteudo key={empresa.id} empresa={empresa} {...resto} />}
      </SheetContent>
    </Sheet>
  );
}

type Secao = "linha" | "negocios" | "dados";

function Conteudo({ empresa: e, empresas, negocios, participante: p, revisar, verNaAbaNegocios, excluir }: Omit<Props, "aoFechar"> & { empresa: MmEmpresa }) {
  const [secao, setSecao] = useState<Secao>("linha");
  const [notaFocada, setNotaFocada] = useState<string>();
  const fotos = useFotosAssinadas(fotosDaEmpresa(e));

  const daEmpresa = useMemo(() => negocios.filter((n) => n.empresa_id === e.id), [negocios, e.id]);
  const linhaDoTempo = useMemo(() => agruparPorDia(montarLinhaDoTempo(e, daEmpresa, p)), [e, daEmpresa, p]);
  const validados = daEmpresa.filter((n) => n.status === "validado");
  const numeros = {
    pendentes: daEmpresa.filter((n) => n.status === "pendente").length,
    indeferidos: daEmpresa.filter((n) => n.status === "indeferido").length,
    aguardando: daEmpresa.filter((n) => !n.resposta_comprador).length,
    valor: validados.reduce((s, n) => s + n.valor_centavos, 0),
    parceiros: new Set(validados.map((n) => n.cnpj_parceiro)).size,
  };
  const listados = notaFocada ? daEmpresa.filter((n) => n.id === notaFocada) : daEmpresa;

  return (
    <>
      <SheetHeader className="p-5 pr-12 border-b border-gray-100 gap-3">
        <div className="min-w-0">
          <SheetTitle className="text-xl font-bold text-gray-900 break-words">{e.razao_social}</SheetTitle>
          <SheetDescription className="text-sm text-gray-500">
            {formatarCnpj(e.cnpj)} · {CATEGORIAS[e.categoria]} · {e.porte} · {e.municipio}/{e.uf}
          </SheetDescription>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Numero titulo="Negócios" valor={String(daEmpresa.length)} detalhe={`${numeros.aguardando} aguardando comprador`} />
          <Numero titulo="Validados" valor={String(validados.length)} detalhe={`${numeros.pendentes} em análise · ${numeros.indeferidos} indeferidos`} />
          <Numero titulo="Valor validado" valor={formatarMoeda(numeros.valor)} detalhe={`${numeros.parceiros} ${numeros.parceiros === 1 ? "parceiro distinto" : "parceiros distintos"}`} />
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Seções da ficha">
          {([
            ["linha", "Linha do tempo"],
            ["negocios", `Negócios (${daEmpresa.length})`],
            ["dados", "Dados da inscrição"],
          ] as [Secao, string][]).map(([id, titulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={secao === id}
              onClick={() => {
                setSecao(id);
                setNotaFocada(undefined);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                secao === id ? "bg-purple-50 text-[#7030A0] border-purple-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {titulo}
            </button>
          ))}
        </nav>
      </SheetHeader>

      <div className="p-5 space-y-5">
        {secao === "linha" && (
          <>
            <p className="text-xs text-gray-500">
              Do mais recente para o mais antigo. Cada nota mostra a situação atual: se uma revisão foi refeita, aparece só a última.
            </p>
            {linhaDoTempo.map((grupo) => (
              <section key={grupo.dia}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{formatarData(grupo.dia)}</h3>
                <ol className="relative ml-4 border-l border-gray-200 space-y-5">
                  {grupo.eventos.map((ev) => {
                    const { Icone, cor } = VISUAL[ev.tipo];
                    return (
                      <li key={ev.id} className="relative pl-7">
                        <span className={`absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white ${cor}`}>
                          <Icone className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <p className="text-sm font-semibold text-gray-900">{ev.titulo}</p>
                          <time dateTime={ev.quando} className="text-xs text-gray-500">{hora(ev.quando)}</time>
                        </div>
                        {ev.detalhe && <p className="text-sm text-gray-600 break-words">{ev.detalhe}</p>}
                        {ev.negocioId && (
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-[#7030A0] hover:underline"
                            onClick={() => {
                              setNotaFocada(ev.negocioId);
                              setSecao("negocios");
                            }}
                          >
                            Ver negócio
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </>
        )}

        {secao === "negocios" && (
          <>
            {notaFocada && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-gray-800">
                Mostrando um negócio da linha do tempo.
                <Button variant="outline" size="sm" onClick={() => setNotaFocada(undefined)}>Ver todos da empresa</Button>
              </div>
            )}
            <ListaNegocios
              negocios={listados}
              empresas={empresas}
              aoRevisar={(n, s, m) => void revisar(n, s, m)}
              vazio="Esta empresa ainda não registrou negócios."
            />
          </>
        )}

        {secao === "dados" && (
          <div className="grid gap-6">
            <dl className="grid gap-2 text-sm">
              <Linha rotulo="Responsável" valor={e.responsavel} />
              <Linha rotulo="E-mail de contato" valor={e.email} />
              <Linha rotulo="Município" valor={`${e.municipio}/${e.uf}`} />
              <Linha rotulo="Inscrita em" valor={new Date(e.criado_em).toLocaleString("pt-BR")} />
              <Linha rotulo="Participante" valor={p ? `${p.nome} · ${p.email} · ${mascaraTelefone(p.telefone)}` : "—"} />
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Sócios e titulares</h3>
              {e.socios.length ? (
                <ul className="space-y-3">
                  {e.socios.map((s, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Avatar nome={s.nome} url={s.foto_path ? fotos.get(s.foto_path) : undefined} tamanho="lg" temFoto={!!s.foto_path} />
                      <div className="min-w-0 text-sm">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-gray-900">{s.nome}</span>
                          {i === 0 && e.categoria === "afro" && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-[#7030A0]">Responsável</span>
                          )}
                        </div>
                        <p className={s.declaracao === "preta_parda" ? "text-[#7030A0] font-medium" : "text-gray-500"}>{DECLARACOES[s.declaracao]}</p>
                        <p className="text-xs text-gray-500">
                          {!s.foto_path ? "Sem foto enviada" : s.foto_autorizada ? "Foto enviada · uso autorizado" : "Foto enviada · uso não autorizado"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Nenhum sócio informado.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Button variant="outline" size="sm" onClick={() => verNaAbaNegocios(e)}>Abrir na aba Negócios</Button>
          <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => excluir(e)}>
            <Trash2 className="w-4 h-4" /> Excluir inscrição
          </Button>
        </div>
      </div>
    </>
  );
}

const VISUAL: Record<TipoEvento, { Icone: LucideIcon; cor: string }> = {
  inscricao: { Icone: Building2, cor: "bg-purple-100 text-[#7030A0]" },
  registro: { Icone: FileText, cor: "bg-gray-100 text-gray-700" },
  confirmado: { Icone: CheckCircle2, cor: "bg-[#e3f3e8] text-[#205c39]" },
  divergencia: { Icone: AlertTriangle, cor: "bg-[#fdf1e3] text-[#7a3f0c]" },
  desconhecido: { Icone: XCircle, cor: "bg-[#fbe8ee] text-[#84243f]" },
  vencido: { Icone: TimerOff, cor: "bg-[#f1f0f3] text-[#4b4357]" },
  validado: { Icone: BadgeCheck, cor: "bg-[#205c39] text-white" },
  indeferido: { Icone: Ban, cor: "bg-[#84243f] text-white" },
  reaberto: { Icone: RotateCcw, cor: "bg-amber-100 text-amber-800" },
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Numero({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 min-w-0">
      <p className="text-xs font-medium text-gray-500">{titulo}</p>
      <p className="text-lg font-bold text-gray-900 break-words">{valor}</p>
      <p className="text-xs text-gray-500">{detalhe}</p>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,160px)_1fr] gap-2">
      <dt className="text-gray-500">{rotulo}</dt>
      <dd className="text-gray-900 break-words m-0">{valor}</dd>
    </div>
  );
}
