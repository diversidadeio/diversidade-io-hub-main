import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { PilhaAvatares, useFotosAssinadas } from "@/components/adm/maiores-melhores/AvatarSocio";
import { EventoDialog, type DadosEvento } from "@/components/adm/maiores-melhores/EventoDialog";
import { FichaEmpresa } from "@/components/adm/maiores-melhores/FichaEmpresa";
import { RankingsMm } from "@/components/adm/maiores-melhores/RankingsMm";
import { exportarEdicaoXlsx } from "@/components/adm/maiores-melhores/exportarMm";
import { ListaNegocios } from "@/components/maiores-melhores/ListaNegocios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import VotacaoAdm from "@/components/adm/maiores-melhores/VotacaoAdm";
import { BUCKET_FOTOS, assinarFotos } from "@/lib/maioresMelhoresApi";
import { mascaraTelefone } from "@/lib/mascaras";
import {
  CATEGORIAS,
  RESPOSTAS_COMPRADOR,
  STATUS_NEGOCIO,
  type Categoria,
  type MmEmpresa,
  type MmEvento,
  type MmNegocio,
  type MmParticipante,
  type StatusNegocio,
  calcularRankings,
  calcularRankingsPorPerfil,
  fotosDaEmpresa,
  formatarCnpj,
  formatarData,
  formatarMoeda,
  situacaoPeriodo,
  valorValidadoSemDuplicar,
} from "@/lib/maioresMelhores";

type Aba = "rankings" | "negocios" | "empresas" | "participantes" | "votacao";

const COLUNAS_NEGOCIO =
  "id,evento_id,empresa_id,perfil_parceiro,cnpj_comprador,cnpj_vendedor,cnpj_parceiro,razao_social_parceiro,data_emissao,valor_centavos,numero_nota,serie_nota,email_comprador,whatsapp_comprador,token_expira_em,resposta_comprador,observacao_comprador,respondido_em,status,motivo,revisado_por,revisado_em,criado_em";

const campo = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";
const rotulo = "grid gap-1.5 text-sm font-medium text-gray-700 min-w-0";
const normalizarBusca = (s: string) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Busca todas as linhas paginando de 1000 em 1000 (limite padrão do PostgREST). */
async function buscarTodos<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const tamanho = 1000;
  const todos: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar(de, de + tamanho - 1);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < tamanho) return todos;
  }
}

function mensagemErro(e: unknown, padrao = "Não foi possível concluir a operação.") {
  const m = (e as { message?: string })?.message;
  return m || padrao;
}

export default function MaioresMelhoresAdm() {
  const [eventos, setEventos] = useState<MmEvento[]>([]);
  const [eventoId, setEventoId] = useState<string>();
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [empresas, setEmpresas] = useState<MmEmpresa[]>([]);
  const [negocios, setNegocios] = useState<MmNegocio[]>([]);
  const [participantes, setParticipantes] = useState<MmParticipante[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [aba, setAba] = useState<Aba>("rankings");
  const [dialogEvento, setDialogEvento] = useState<{ aberto: boolean; evento?: MmEvento | null }>({ aberto: false });
  /** Empresa escolhida no filtro da aba Negócios ("" = todas). */
  const [filtroEmpresaId, setFiltroEmpresaId] = useState("");
  /** Empresa com a ficha (painel lateral) aberta. */
  const [fichaId, setFichaId] = useState<string>();
  const [excluirEmpresa, setExcluirEmpresa] = useState<MmEmpresa>();
  const [excluirEvento, setExcluirEvento] = useState<MmEvento>();
  const [processando, setProcessando] = useState(false);

  const evento = eventos.find((e) => e.id === eventoId);

  const carregarEventos = useCallback(async (selecionar?: string) => {
    setCarregandoEventos(true);
    try {
      const { data, error } = await supabase.from("mm_eventos").select("*").order("ano", { ascending: false });
      if (error) throw error;
      const lista = (data ?? []) as MmEvento[];
      setEventos(lista);
      setEventoId((atual) => {
        if (selecionar && lista.some((e) => e.id === selecionar)) return selecionar;
        if (atual && lista.some((e) => e.id === atual)) return atual;
        return (lista.find((e) => e.ativo) ?? lista[0])?.id;
      });
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao carregar as edições. Verifique se a migration 34 foi aplicada."));
    } finally {
      setCarregandoEventos(false);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    if (!eventoId) {
      setEmpresas([]);
      setNegocios([]);
      setParticipantes([]);
      return;
    }
    setCarregandoDados(true);
    try {
      const [listaEmpresas, listaNegocios, listaParticipantes] = await Promise.all([
        buscarTodos<MmEmpresa>((de, ate) =>
          supabase.from("mm_empresas").select("*").eq("evento_id", eventoId).order("criado_em", { ascending: false }).range(de, ate),
        ),
        buscarTodos<MmNegocio>((de, ate) =>
          supabase
            .from("mm_negocios")
            .select(COLUNAS_NEGOCIO)
            .eq("evento_id", eventoId)
            .order("data_emissao", { ascending: false })
            .order("criado_em", { ascending: false })
            .range(de, ate) as unknown as PromiseLike<{ data: MmNegocio[] | null; error: unknown }>,
        ),
        buscarTodos<MmParticipante>((de, ate) =>
          supabase
            .from("mm_participantes")
            .select("id,evento_id,nome,email,telefone,criado_em")
            .eq("evento_id", eventoId)
            .order("criado_em", { ascending: false })
            .range(de, ate),
        ),
      ]);

      // Participantes que entraram em edições anteriores e inscreveram empresa nesta
      const conhecidos = new Set(listaParticipantes.map((p) => p.id));
      const faltantes = [...new Set(listaEmpresas.map((e) => e.participante_id).filter((id): id is string => !!id && !conhecidos.has(id)))];
      for (let i = 0; i < faltantes.length; i += 200) {
        const { data, error } = await supabase
          .from("mm_participantes")
          .select("id,evento_id,nome,email,telefone,criado_em")
          .in("id", faltantes.slice(i, i + 200));
        if (error) throw error;
        listaParticipantes.push(...((data ?? []) as MmParticipante[]));
      }

      setEmpresas(listaEmpresas);
      setNegocios(listaNegocios);
      setParticipantes(listaParticipantes);
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao carregar os dados da edição."));
    } finally {
      setCarregandoDados(false);
    }
  }, [eventoId]);

  useEffect(() => {
    void carregarEventos();
  }, [carregarEventos]);

  useEffect(() => {
    setFiltroEmpresaId("");
    setFichaId(undefined);
    void carregarDados();
  }, [carregarDados]);

  async function salvarEvento(dados: DadosEvento) {
    const editando = dialogEvento.evento;
    const { data, error } = editando
      ? await supabase.from("mm_eventos").update(dados).eq("id", editando.id).select("id").single()
      : await supabase.from("mm_eventos").insert(dados).select("id").single();
    if (error) {
      toast.error(error.code === "23505" ? `Já existe uma edição para ${dados.ano}.` : mensagemErro(error));
      return false;
    }
    toast.success(editando ? "Edição atualizada." : "Edição criada. Ative-a quando quiser abrir as inscrições.");
    await carregarEventos(data?.id);
    return true;
  }

  async function alternarAtivo(alvo: MmEvento) {
    setProcessando(true);
    const { error } = await supabase.rpc("mm_definir_evento_ativo", { p_id: alvo.id, p_ativo: !alvo.ativo });
    setProcessando(false);
    if (error) return toast.error(mensagemErro(error));
    toast.success(alvo.ativo ? `Edição ${alvo.ano} desativada. O convite saiu da página inicial.` : `Edição ${alvo.ano} ativada.`);
    await carregarEventos(alvo.id);
  }

  async function confirmarExclusaoEvento() {
    if (!excluirEvento) return;
    setProcessando(true);
    const { error } = await supabase.from("mm_eventos").delete().eq("id", excluirEvento.id);
    setProcessando(false);
    if (error) {
      toast.error(error.code === "23503" ? "Esta edição já possui inscrições e não pode ser excluída." : mensagemErro(error));
      return;
    }
    toast.success(`Edição ${excluirEvento.ano} excluída.`);
    setExcluirEvento(undefined);
    await carregarEventos();
  }

  async function revisar(n: MmNegocio, status: StatusNegocio, motivo: string) {
    const { error } = await supabase.rpc("mm_revisar_negocio", {
      p_id: n.id,
      p_status: status,
      p_motivo: motivo,
      p_status_anterior: n.status,
    });
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success(status === "validado" ? "Negócio validado." : status === "indeferido" ? "Negócio indeferido." : "Negócio voltou para análise.");
    await carregarDados();
  }

  async function confirmarExclusaoEmpresa() {
    if (!excluirEmpresa) return;
    setProcessando(true);
    const { error } = await supabase.from("mm_empresas").delete().eq("id", excluirEmpresa.id);
    const fotos = fotosDaEmpresa(excluirEmpresa);
    if (!error && fotos.length) {
      await supabase.storage.from(BUCKET_FOTOS).remove(fotos);
    }
    setProcessando(false);
    if (error) return toast.error(mensagemErro(error));
    toast.success("Inscrição excluída. O CNPJ pode ser inscrito novamente.");
    if (filtroEmpresaId === excluirEmpresa.id) setFiltroEmpresaId("");
    setExcluirEmpresa(undefined);
    await carregarDados();
  }

  const metricas = useMemo(() => {
    const prontos = negocios.filter((n) => n.status === "pendente" && n.resposta_comprador === "confirmado").length;
    return {
      afro: empresas.filter((e) => e.categoria === "afro").length,
      inclusiva: empresas.filter((e) => e.categoria === "inclusiva").length,
      pendentes: negocios.filter((n) => n.status === "pendente").length,
      prontos,
      aprovados: negocios.filter((n) => n.resposta_comprador === "confirmado").length,
      aguardando: negocios.filter((n) => !n.resposta_comprador).length,
      recusados: negocios.filter((n) => n.resposta_comprador === "divergencia" || n.resposta_comprador === "desconhecido").length,
      valor: valorValidadoSemDuplicar(negocios),
    };
  }, [empresas, negocios]);

  const periodo = evento ? situacaoPeriodo(evento) : null;

  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-8 h-8 text-[#7030A0]" /> Maiores &amp; Melhores
            </h1>
            <p className="text-gray-600 mt-1">Edições, inscrições, negócios e apuração da premiação no Empreendedorismo Negro.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/maiores-e-melhores" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" /> Página pública
              </a>
            </Button>
            <Button onClick={() => setDialogEvento({ aberto: true, evento: null })} className="bg-[#7030A0] hover:bg-[#5b2683] text-white">
              <Plus className="w-4 h-4" /> Nova edição
            </Button>
          </div>
        </div>

        {carregandoEventos && !eventos.length ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" /></div>
        ) : !eventos.length ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center space-y-3">
            <CalendarDays className="w-10 h-10 mx-auto text-[#7030A0]" />
            <p className="text-gray-700 font-medium">Nenhuma edição cadastrada.</p>
            <p className="text-gray-500 text-sm">Crie a edição do ano, defina o período de inscrições e ative-a para abrir o formulário e exibir o convite na página inicial.</p>
            <Button onClick={() => setDialogEvento({ aberto: true, evento: null })} className="bg-[#7030A0] hover:bg-[#5b2683] text-white">
              <Plus className="w-4 h-4" /> Criar primeira edição
            </Button>
          </div>
        ) : (
          <>
            {/* Edição selecionada */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <label className={`${rotulo} w-full sm:w-56`}>
                  Edição
                  <select className={campo} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
                    {eventos.map((e) => (
                      <option key={e.id} value={e.id}>{e.ano}{e.ativo ? " — ativa" : ""}</option>
                    ))}
                  </select>
                </label>
                {evento && (
                  <div className="flex flex-wrap items-center gap-2 pb-0.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${evento.ativo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                      {evento.ativo ? "Ativa" : "Inativa"}
                    </span>
                    {evento.ativo && periodo && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          periodo === "aberto" ? "bg-purple-100 text-[#7030A0]" : periodo === "agendado" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {periodo === "aberto" ? "Inscrições abertas · convite na página inicial" : periodo === "agendado" ? "Inscrições agendadas" : "Inscrições encerradas"}
                      </span>
                    )}
                    <span className="text-sm text-gray-600">
                      {formatarData(evento.inicio_cadastro)} a {formatarData(evento.fim_cadastro)}
                    </span>
                  </div>
                )}
              </div>
              {evento && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={processando}
                    onClick={() => void alternarAtivo(evento)}
                    className={evento.ativo ? "border-red-200 text-red-700 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}
                  >
                    <Power className="w-4 h-4" /> {evento.ativo ? "Desativar edição" : "Ativar edição"}
                  </Button>
                  <Button variant="outline" onClick={() => setDialogEvento({ aberto: true, evento })}>
                    <Pencil className="w-4 h-4" /> Editar período e textos
                  </Button>
                  <Button variant="outline" disabled={carregandoDados} onClick={() => void carregarDados()}>
                    <RefreshCw className={`w-4 h-4 ${carregandoDados ? "animate-spin" : ""}`} /> Atualizar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={carregandoDados}
                    onClick={() => void exportarEdicaoXlsx(evento, empresas, negocios, participantes).catch(() => toast.error("Erro ao gerar a planilha."))}
                  >
                    <Download className="w-4 h-4" /> Exportar Excel
                  </Button>
                  {!empresas.length && !negocios.length && (
                    <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setExcluirEvento(evento)}>
                      <Trash2 className="w-4 h-4" /> Excluir edição
                    </Button>
                  )}
                </div>
              )}
            </section>

            {/* Indicadores */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <Indicador titulo="Empresas inscritas" valor={String(empresas.length)} detalhe={`${metricas.afro} afro · ${metricas.inclusiva} inclusivas`} />
              <Indicador titulo="Participantes" valor={String(participantes.length)} detalhe="Pessoas que acessaram o formulário" />
              <Indicador titulo="Negócios em análise" valor={String(metricas.pendentes)} detalhe={metricas.prontos === 1 ? "1 pronto para validar" : `${metricas.prontos} prontos para validar`} />
              <Indicador
                titulo="Aprovados pelo comprador"
                valor={String(metricas.aprovados)}
                detalhe={`${metricas.aguardando} aguardando resposta · ${metricas.recusados} com divergência ou não ${metricas.recusados === 1 ? "reconhecido" : "reconhecidos"}`}
              />
              <Indicador titulo="Valor validado" valor={formatarMoeda(metricas.valor)} detalhe="Sem duplicar notas" />
            </div>

            {/* Abas */}
            <nav className="flex flex-wrap gap-2" aria-label="Seções da premiação">
              {([
                ["rankings", "Rankings"],
                ["votacao", "Votação popular"],
                ["negocios", `Negócios (${negocios.length})`],
                ["empresas", `Empresas inscritas (${empresas.length})`],
                ["participantes", `Participantes (${participantes.length})`],
              ] as [Aba, string][]).map(([id, titulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAba(id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    aba === id ? "bg-purple-50 text-[#7030A0] border-purple-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {titulo}
                </button>
              ))}
            </nav>

            {carregandoDados && !empresas.length && !negocios.length ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" /></div>
            ) : (
              <>
                {aba === "rankings" && <AbaRankings empresas={empresas} negocios={negocios} />}
                {aba === "votacao" && evento && <VotacaoAdm key={evento.id} evento={evento} empresas={empresas} />}
                {aba === "negocios" && (
                  <AbaNegocios
                    empresas={empresas}
                    negocios={negocios}
                    empresaId={filtroEmpresaId}
                    setEmpresaId={setFiltroEmpresaId}
                    abrirFicha={(e) => setFichaId(e.id)}
                    revisar={revisar}
                  />
                )}
                {aba === "empresas" && evento && (
                  <AbaEmpresas
                    empresas={empresas}
                    negocios={negocios}
                    participantes={participantes}
                    evento={evento}
                    abrirFicha={(e) => setFichaId(e.id)}
                  />
                )}
                {aba === "participantes" && (
                  <AbaParticipantes participantes={participantes} empresas={empresas} abrirFicha={(e) => setFichaId(e.id)} />
                )}
              </>
            )}
          </>
        )}
      </div>

      <FichaEmpresa
        empresa={empresas.find((e) => e.id === fichaId)}
        empresas={empresas}
        negocios={negocios}
        participante={participantes.find((p) => p.id === empresas.find((e) => e.id === fichaId)?.participante_id)}
        aoFechar={() => setFichaId(undefined)}
        revisar={revisar}
        verNaAbaNegocios={(e) => {
          setFiltroEmpresaId(e.id);
          setAba("negocios");
          setFichaId(undefined);
        }}
        excluir={(e) => {
          setFichaId(undefined);
          setExcluirEmpresa(e);
        }}
      />

      <EventoDialog
        aberto={dialogEvento.aberto}
        evento={dialogEvento.evento}
        aoFechar={() => setDialogEvento({ aberto: false })}
        aoSalvar={salvarEvento}
      />

      <ConfirmarExclusao
        aberto={!!excluirEmpresa}
        titulo="Excluir inscrição"
        processando={processando}
        aoFechar={() => setExcluirEmpresa(undefined)}
        aoConfirmar={confirmarExclusaoEmpresa}
      >
        <p className="text-sm text-gray-700">
          Você vai excluir a inscrição de <strong>{excluirEmpresa?.razao_social}</strong> ({excluirEmpresa && formatarCnpj(excluirEmpresa.cnpj)}),
          com todos os negócios registrados por ela e a foto enviada. <strong>Esta ação não pode ser desfeita.</strong>
        </p>
      </ConfirmarExclusao>

      <ConfirmarExclusao
        aberto={!!excluirEvento}
        titulo="Excluir edição"
        processando={processando}
        aoFechar={() => setExcluirEvento(undefined)}
        aoConfirmar={confirmarExclusaoEvento}
      >
        <p className="text-sm text-gray-700">
          Você vai excluir a edição <strong>{excluirEvento?.ano}</strong>. Ela ainda não tem inscrições. Esta ação não pode ser desfeita.
        </p>
      </ConfirmarExclusao>
    </LayoutAdm>
  );
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 min-w-0">
      <p className="text-sm font-medium text-gray-500">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 break-words">{valor}</p>
      <p className="text-xs text-gray-500 mt-1">{detalhe}</p>
    </div>
  );
}

function FiltroDatas({ inicio, fim, setInicio, setFim }: { inicio: string; fim: string; setInicio: (v: string) => void; setFim: (v: string) => void }) {
  return (
    <>
      <label className={rotulo}>
        Emissão a partir de
        <input type="date" className={campo} value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </label>
      <label className={rotulo}>
        Emissão até
        <input type="date" className={campo} value={fim} onChange={(e) => setFim(e.target.value)} />
      </label>
    </>
  );
}

function AbaRankings({ empresas, negocios }: { empresas: MmEmpresa[]; negocios: MmNegocio[] }) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const { rankings, porPerfil } = useMemo(() => {
    const doPeriodo = negocios.filter((n) => (!inicio || n.data_emissao >= inicio) && (!fim || n.data_emissao <= fim));
    return { rankings: calcularRankings(empresas, doPeriodo), porPerfil: calcularRankingsPorPerfil(empresas, doPeriodo) };
  }, [empresas, negocios, inicio, fim]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FiltroDatas inicio={inicio} fim={fim} setInicio={setInicio} setFim={setFim} />
      </div>
      {inicio && fim && inicio > fim && <p className="text-sm text-red-600" role="alert">A data final deve ser igual ou posterior à inicial.</p>}
      <p className="text-sm text-gray-600">
        Somente negócios validados entram na apuração. Cada CNPJ parceiro conta uma vez por empresa. Empates compartilham a posição.
      </p>
      <RankingsMm rankings={rankings} />
      <section className="space-y-3 pt-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Afroempreendedores por perfil da parceira</h2>
          <p className="text-sm text-gray-600">
            Mesmo critério do ranking geral, considerando só os negócios com cada perfil: empresas lideradas por pessoas negras, médias
            empresas inclusivas e grandes empresas inclusivas.
          </p>
        </div>
        <RankingsMm rankings={porPerfil} />
      </section>
    </div>
  );
}

function AbaNegocios({
  empresas,
  negocios,
  empresaId,
  setEmpresaId,
  abrirFicha,
  revisar,
}: {
  empresas: MmEmpresa[];
  negocios: MmNegocio[];
  empresaId: string;
  setEmpresaId: (id: string) => void;
  abrirFicha: (e: MmEmpresa) => void;
  revisar: (n: MmNegocio, status: StatusNegocio, motivo: string) => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [resposta, setResposta] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const termo = normalizarBusca(busca.trim());
  const nomes = new Map(empresas.map((e) => [e.id, e]));
  const filtroEmpresa = empresaId ? nomes.get(empresaId) : undefined;
  const opcoesEmpresa = useMemo(() => {
    const quantos = new Map<string, number>();
    for (const n of negocios) quantos.set(n.empresa_id, (quantos.get(n.empresa_id) ?? 0) + 1);
    return [...empresas]
      .sort((a, b) => a.razao_social.localeCompare(b.razao_social, "pt-BR"))
      .map((e) => ({ id: e.id, rotulo: `${e.razao_social} (${quantos.get(e.id) ?? 0})` }));
  }, [empresas, negocios]);
  const filtrados = negocios.filter((n) => {
    if (filtroEmpresa && n.empresa_id !== filtroEmpresa.id) return false;
    if (status && n.status !== status) return false;
    if (resposta === "aguardando" ? !!n.resposta_comprador : resposta && n.resposta_comprador !== resposta) return false;
    if (inicio && n.data_emissao < inicio) return false;
    if (fim && n.data_emissao > fim) return false;
    if (!termo) return true;
    const e = nomes.get(n.empresa_id);
    const texto = [n.razao_social_parceiro, n.cnpj_comprador, n.cnpj_vendedor, formatarCnpj(n.cnpj_comprador), formatarCnpj(n.cnpj_vendedor), n.numero_nota, n.email_comprador, e?.razao_social ?? ""].join(" ");
    return normalizarBusca(texto).includes(termo);
  });

  return (
    <div className="space-y-4">
      {filtroEmpresa && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-800">
            Negócios de <strong>{filtroEmpresa.razao_social}</strong> · {formatarCnpj(filtroEmpresa.cnpj)}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => abrirFicha(filtroEmpresa)}>Abrir ficha da empresa</Button>
            <Button variant="outline" size="sm" onClick={() => setEmpresaId("")}>Ver todos os negócios</Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className={rotulo}>
          Empresa inscrita
          <select className={campo} value={filtroEmpresa ? empresaId : ""} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Todas as empresas</option>
            {opcoesEmpresa.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
        </label>
        <label className={rotulo}>
          Razão social, CNPJ ou nota
          <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label className={rotulo}>
          Situação
          <select className={campo} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS_NEGOCIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className={rotulo}>
          Confirmação do comprador
          <select className={campo} value={resposta} onChange={(e) => setResposta(e.target.value)}>
            <option value="">Todas</option>
            <option value="aguardando">Aguardando resposta</option>
            {Object.entries(RESPOSTAS_COMPRADOR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <FiltroDatas inicio={inicio} fim={fim} setInicio={setInicio} setFim={setFim} />
      </div>
      <p className="text-sm text-gray-600">
        {filtrados.length} de {negocios.length} negócios. A validação só é liberada depois que o comprador confirma a nota.
      </p>
      <ListaNegocios
        negocios={filtrados}
        empresas={empresas}
        aoRevisar={(n, s, m) => void revisar(n, s, m)}
        aoAbrirEmpresa={abrirFicha}
      />
    </div>
  );
}

function AbaEmpresas({
  empresas,
  negocios,
  participantes,
  evento,
  abrirFicha,
}: {
  empresas: MmEmpresa[];
  negocios: MmNegocio[];
  participantes: MmParticipante[];
  evento: MmEvento;
  abrirFicha: (e: MmEmpresa) => void;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<"" | Categoria>("");
  const [exportando, setExportando] = useState(false);
  const termo = normalizarBusca(busca.trim());

  const filtradas = empresas.filter(
    (e) =>
      (!categoria || e.categoria === categoria) &&
      (!termo || normalizarBusca(`${e.razao_social} ${e.cnpj} ${formatarCnpj(e.cnpj)} ${e.responsavel} ${e.email} ${e.municipio}`).includes(termo)),
  );

  const fotos = useFotosAssinadas(filtradas.flatMap(fotosDaEmpresa));

  async function exportar() {
    setExportando(true);
    try {
      const ids = new Set(filtradas.map((e) => e.id));
      const filtrando = filtradas.length !== empresas.length;
      const donos = new Set(filtradas.map((e) => e.participante_id));
      // Link das fotos válido por 7 dias: a planilha costuma circular depois de gerada.
      const links = await assinarFotos(filtradas.flatMap(fotosDaEmpresa), 7 * 24 * 60 * 60);
      await exportarEdicaoXlsx(
        evento,
        filtradas,
        negocios.filter((n) => ids.has(n.empresa_id)),
        filtrando ? participantes.filter((p) => donos.has(p.id)) : participantes,
        links,
      );
      toast.success(`Planilha gerada com ${filtradas.length} ${filtradas.length === 1 ? "empresa" : "empresas"}. Os links das fotos valem por 7 dias.`);
    } catch {
      toast.error("Erro ao gerar a planilha.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-4">
        <label className={rotulo}>
          Razão social, CNPJ, responsável ou município
          <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <label className={rotulo}>
          Categoria
          <select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value as "" | Categoria)}>
            <option value="">Todas</option>
            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {filtradas.length} {filtradas.length === 1 ? "empresa" : "empresas"}
          {filtradas.length !== empresas.length && ` de ${empresas.length}`}
        </p>
        <Button variant="outline" size="sm" disabled={exportando || !filtradas.length} onClick={() => void exportar()}>
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar Excel
        </Button>
      </div>
      {!filtradas.length ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500">Nenhuma empresa encontrada.</div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((e) => {
            const doNegocio = negocios.filter((n) => n.empresa_id === e.id);
            const validados = doNegocio.filter((n) => n.status === "validado").length;
            const emAnalise = doNegocio.filter((n) => n.status === "pendente").length;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => abrirFicha(e)}
                title="Abrir ficha e linha do tempo"
                className="w-full text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-2 hover:border-purple-200 hover:bg-purple-50/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PilhaAvatares socios={e.socios} fotos={fotos} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{e.razao_social}</p>
                    <p className="text-sm text-gray-500">
                      {formatarCnpj(e.cnpj)} · {CATEGORIAS[e.categoria]} · {e.porte} · {e.municipio}/{e.uf}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">{doNegocio.length} negócios</span>
                  {emAnalise > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">{emAnalise} em análise</span>}
                  <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-medium">{validados} validados</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AbaParticipantes({
  participantes,
  empresas,
  abrirFicha,
}: {
  participantes: MmParticipante[];
  empresas: MmEmpresa[];
  abrirFicha: (e: MmEmpresa) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca.trim());
  const filtrados = participantes
    .filter((p) => !termo || normalizarBusca(`${p.nome} ${p.email} ${p.telefone}`).includes(termo))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  return (
    <div className="space-y-4">
      <label className={`${rotulo} max-w-md`}>
        Nome, e-mail ou telefone
        <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      {!filtrados.length ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500">Nenhum participante encontrado.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Primeiro acesso</th>
                <th className="p-3 font-semibold text-gray-700">Nome</th>
                <th className="p-3 font-semibold text-gray-700">E-mail</th>
                <th className="p-3 font-semibold text-gray-700 whitespace-nowrap">Telefone</th>
                <th className="p-3 font-semibold text-gray-700">Empresas inscritas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((p) => {
                const minhas = empresas.filter((e) => e.participante_id === p.id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 align-top">
                    <td className="p-3 text-gray-600 whitespace-nowrap">{new Date(p.criado_em).toLocaleString("pt-BR")}</td>
                    <td className="p-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="p-3 text-gray-700 break-all">{p.email}</td>
                    <td className="p-3 text-gray-700 whitespace-nowrap">{mascaraTelefone(p.telefone)}</td>
                    <td className="p-3 text-gray-700">
                      {minhas.length ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {minhas.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              title="Abrir ficha e linha do tempo"
                              className="text-left font-medium text-[#7030A0] hover:underline"
                              onClick={() => abrirFicha(e)}
                            >
                              {e.razao_social}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-700">Não concluiu inscrição</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfirmarExclusao({
  aberto,
  titulo,
  processando,
  aoFechar,
  aoConfirmar,
  children,
}: {
  aberto: boolean;
  titulo: string;
  processando: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !processando && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" /> {titulo}
          </DialogTitle>
          <DialogDescription className="sr-only">Confirmação de exclusão</DialogDescription>
        </DialogHeader>
        <div className="py-2">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={aoFechar} disabled={processando}>Cancelar</Button>
          <Button onClick={aoConfirmar} disabled={processando} className="bg-red-600 hover:bg-red-700 text-white">
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
