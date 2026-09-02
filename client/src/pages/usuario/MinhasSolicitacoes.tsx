import { useEffect, useState } from "react";
import { LayoutUsuario } from "@/components/LayoutUsuario";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import {
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Monitor,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Users,
  Link2,
  Copy,
  Check,
  CalendarClock,
  ThumbsUp,
  ThumbsDown,
  Send as SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  montarLinkOportunidade, copiarParaAreaDeTransferencia,
  mensagemCompartilhamento, infoPrazo,
} from "@/lib/oportunidade";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface SolicitacaoBusca {
  id: string;
  cnaes: string[];
  cidade: string;
  modalidade: "online" | "presencial" | "ambos";
  descricao: string | null;
  documento_url: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  criado_em: string;
  titulo?: string | null;
  prazo_final?: string | null;
  compartilhavel?: boolean;
  usuario_id?: string | null;
  empresas_indicadas?: string[] | null;
}

/** Quem respondeu ao link compartilhado. */
interface ParticipacaoSolicitacao {
  id: string;
  solicitacao_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  quer_participar: boolean;
  mensagem: string | null;
  criado_em: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const ROTULOS_STATUS: Record<
  string,
  { label: string; cor: string; bg: string; icone: React.ReactNode }
> = {
  pendente: {
    label: "Aguardando análise",
    cor: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
    icone: <Clock className="w-4 h-4 text-orange-500" />,
  },
  em_andamento: {
    label: "Em andamento",
    cor: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icone: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  },
  concluido: {
    label: "Concluído",
    cor: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icone: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  },
  cancelado: {
    label: "Cancelado",
    cor: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
    icone: <AlertCircle className="w-4 h-4 text-gray-400" />,
  },
};

const ROTULOS_MODALIDADE: Record<string, string> = {
  online: "🌐 Online",
  presencial: "📍 Presencial",
  ambos: "✅ Online e Presencial",
};

import { ModalSolicitarBusca } from "@/components/usuario/ModalSolicitarBusca";

// ── Componente ───────────────────────────────────────────────────────────────
export default function MinhasSolicitacoes() {
  const { usuario } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoBusca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [empresasDict, setEmpresasDict] = useState<Record<string, any>>({});
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<any[]>([]);
  const isAdmin = (usuario as any)?.papel === "admin";
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<string>("todos");
  const [cliquesPorSolicitacao, setCliquesPorSolicitacao] = useState<Record<string, number>>({});
  const [participacoes, setParticipacoes] = useState<Record<string, ParticipacaoSolicitacao[]>>({});
  const [idCopiado, setIdCopiado] = useState<string | null>(null);

  /** Copia o link (ou a mensagem pronta) da oportunidade para compartilhar. */
  async function copiarLink(sol: SolicitacaoBusca, comTexto = false) {
    const link = montarLinkOportunidade(sol.id);
    const ok = await copiarParaAreaDeTransferencia(comTexto ? mensagemCompartilhamento(sol, link) : link);
    if (!ok) {
      toast.error("Não foi possível copiar. Link: " + link);
      return;
    }
    setIdCopiado(sol.id);
    setTimeout(() => setIdCopiado((atual) => (atual === sol.id ? null : atual)), 2000);
    toast.success(comTexto ? "Mensagem copiada!" : "Link copiado!");
  }

  /** Busca cliques e respostas das solicitações da empresa. */
  async function carregarAlcance(ids: string[]) {
    if (ids.length === 0) {
      setCliquesPorSolicitacao({});
      setParticipacoes({});
      return;
    }
    try {
      const [{ data: views }, { data: parts }] = await Promise.all([
        supabase.from("solicitacao_visualizacoes").select("solicitacao_id").in("solicitacao_id", ids),
        supabase
          .from("solicitacao_participacoes")
          .select("id, solicitacao_id, nome, email, telefone, quer_participar, mensagem, criado_em")
          .in("solicitacao_id", ids)
          .order("criado_em", { ascending: false }),
      ]);

      const cliques: Record<string, number> = {};
      ids.forEach((id) => { cliques[id] = 0; });
      (views || []).forEach((v: any) => { if (cliques[v.solicitacao_id] !== undefined) cliques[v.solicitacao_id]++; });
      setCliquesPorSolicitacao(cliques);

      const porSolicitacao: Record<string, ParticipacaoSolicitacao[]> = {};
      (parts || []).forEach((p: any) => {
        if (!porSolicitacao[p.solicitacao_id]) porSolicitacao[p.solicitacao_id] = [];
        porSolicitacao[p.solicitacao_id].push(p);
      });
      setParticipacoes(porSolicitacao);
    } catch (err) {
      console.error("Erro ao carregar alcance das solicitações:", err);
    }
  }

  const carregarUsuarios = async () => {
    if (!isAdmin || !usuario) return;

    const { data } = await supabase
      .from("empresa_usuarios")
      .select("id, nome, email, auth_user_id")
      .eq("empresa_id", (usuario as any).empresaId)
      .eq("status", "ativo");

    // Remove o admin logado para não duplicar com "Minhas Solicitações"
    const usuariosSemAdmin = (data || []).filter(u => 
      u.auth_user_id !== usuario?.id && u.id !== (usuario as any).id
    );
    setUsuariosEmpresa(usuariosSemAdmin);
  };

  const carregar = async () => {
    if (!usuario) return;
    try {
      setCarregando(true);
      
      let query = supabase
        .from("solicitacoes_busca")
        .select("*")
        .eq("empresa_id", (usuario as any).empresaId);

      const uid = usuario.id;

      if (isAdmin) {
        if (filtroUsuarioId === "meus" && uid) {
          query = query.eq("usuario_id", uid);
        } else if (filtroUsuarioId !== "todos") {
          query = query.eq("usuario_id", filtroUsuarioId);
        }
        // Se for "todos", não filtra por usuario_id (vê toda a empresa)
      } else {
        // Usuário comum SEMPRE vê apenas as estritamente dele
        if (uid) query = query.eq("usuario_id", uid);
      }

      const { data, error } = await query.order("criado_em", { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
      carregarAlcance((data || []).map((s: any) => s.id));

      // Busca dados das empresas indicadas
      const indicadasIds = new Set<string>();
      (data || []).forEach(sol => {
        if (sol.empresas_indicadas) {
          sol.empresas_indicadas.forEach((id: string) => indicadasIds.add(id));
        }
      });
      if (indicadasIds.size > 0) {
        const { data: empData } = await supabase
          .from("empresas")
          .select("id, razao_social, cnpj, email")
          .in("id", Array.from(indicadasIds));
        const empDict: Record<string, any> = {};
        (empData || []).forEach(e => { empDict[e.id] = e; });
        setEmpresasDict(empDict);
      }

    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, [usuario]);

  useEffect(() => {
    carregar();
  }, [usuario, filtroUsuarioId]);

  function toggleExpandido(id: string) {
    setExpandido((prev) => (prev === id ? null : id));
  }

  return (
    <LayoutUsuario activePath="/meu-cadastro/minhas-solicitacoes">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Minhas Solicitações
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Acompanhe o status das suas solicitações de busca de empreendedores.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <select
                value={filtroUsuarioId}
                onChange={(e) => setFiltroUsuarioId(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all max-w-[220px]"
              >
                <option value="todos">Visualizar Todas (Empresa)</option>
                <option value="meus">Minhas Solicitações</option>
                {usuariosEmpresa.length > 0 && (
                  <optgroup label="Por Usuário">
                    {usuariosEmpresa.map((u) => (
                      <option key={u.id} value={u.auth_user_id || u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            <button
              onClick={() => setModalAberto(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#7030A0] text-white border border-[#7030A0] hover:bg-purple-800"
            >
              <Send className="w-4 h-4" />
              Solicitar Busca
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {carregando ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Send className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">
              Nenhuma solicitação enviada ainda
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Use o botão "Solicitar Busca" na aba Pesquisas para enviar sua primeira solicitação.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {solicitacoes.map((sol) => {
              const statusInfo = ROTULOS_STATUS[sol.status];
              const aberto = expandido === sol.id;

              return (
                <div
                  key={sol.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all"
                >
                  {/* Cabeçalho do card — clicável para expandir */}
                  <button
                    onClick={() => toggleExpandido(sol.id)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Ícone de status */}
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${statusInfo.bg}`}
                      >
                        {statusInfo.icone}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* CNAEs */}
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {sol.cnaes.map((cnae, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium"
                            >
                              {cnae}
                            </span>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {sol.cidade}
                          </span>
                          <span className="flex items-center gap-1">
                            <Monitor className="w-3.5 h-3.5" />
                            {ROTULOS_MODALIDADE[sol.modalidade]}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(sol.criado_em).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          {(() => {
                            const prazo = infoPrazo(sol.prazo_final);
                            if (!prazo) return null;
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${prazo.cor}`}>
                                <CalendarClock className="w-3 h-3" /> {prazo.data} · {prazo.texto}
                              </span>
                            );
                          })()}
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Link2 className="w-3.5 h-3.5" />
                            {cliquesPorSolicitacao[sol.id] ?? 0}
                          </span>
                          {(participacoes[sol.id] || []).some((p) => p.quer_participar) && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {(participacoes[sol.id] || []).filter((p) => p.quer_participar).length}
                            </span>
                          )}
                          {isAdmin && sol.usuario_id && (
                            <span className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300">
                              <Users className="w-3 h-3" />
                              {sol.usuario_id === usuario?.id 
                                ? usuario?.nome 
                                : (usuariosEmpresa.find(u => u.auth_user_id === sol.usuario_id || u.id === sol.usuario_id)?.nome || "Usuário")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {/* Badge de status */}
                      <span
                        className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.cor}`}
                      >
                        {statusInfo.icone}
                        {statusInfo.label}
                      </span>
                      {aberto ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {aberto && (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-5 space-y-5 bg-gray-50/50 dark:bg-gray-700/20">
                      {/* Link compartilhável */}
                      <div>
                        <p className="text-xs text-[#7030A0] dark:text-purple-400 mb-2 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" /> Divulgar esta oportunidade
                        </p>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-100 dark:border-purple-900 p-4 space-y-3">
                          {sol.compartilhavel === false ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              O compartilhamento desta solicitação foi desativado pela equipe Diversidade.io.
                            </p>
                          ) : infoPrazo(sol.prazo_final)?.encerrado ? (
                            <div className="flex items-start gap-2">
                              <CalendarClock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                O prazo terminou em {infoPrazo(sol.prazo_final)?.data} e o link foi encerrado
                                automaticamente. Quem abrir agora vê um aviso de prazo encerrado.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  readOnly
                                  value={montarLinkOportunidade(sol.id)}
                                  onFocus={(e) => e.currentTarget.select()}
                                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs font-mono text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                />
                                <button
                                  onClick={() => copiarLink(sol)}
                                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#7030A0] text-white text-sm font-medium hover:bg-purple-800 transition-colors flex-shrink-0"
                                >
                                  {idCopiado === sol.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                  {idCopiado === sol.id ? "Copiado" : "Copiar link"}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                  onClick={() => copiarLink(sol, true)}
                                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">Copiar texto</span>
                                </button>
                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(mensagemCompartilhamento(sol, montarLinkOportunidade(sol.id)))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                                >
                                  <SendIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">WhatsApp</span>
                                </a>
                                <a
                                  href={montarLinkOportunidade(sol.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate">Ver página</span>
                                </a>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Só quem tem conta na Diversidade.io consegue abrir o link — o visitante é convidado a entrar ou se cadastrar.
                                {infoPrazo(sol.prazo_final)
                                  ? ` O link fica no ar até ${infoPrazo(sol.prazo_final)?.data}.`
                                  : ""}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quem respondeu ao link */}
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> Alcance do link
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-3 text-center">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{cliquesPorSolicitacao[sol.id] ?? 0}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">cliques</p>
                          </div>
                          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-3 text-center">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {(participacoes[sol.id] || []).filter((p) => p.quer_participar).length}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">querem participar</p>
                          </div>
                          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-3 text-center col-span-2 sm:col-span-1">
                            <p className="text-lg font-bold text-gray-400">
                              {(participacoes[sol.id] || []).filter((p) => !p.quer_participar).length}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">sem interesse</p>
                          </div>
                        </div>

                        {(participacoes[sol.id] || []).length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Ninguém respondeu ao link ainda.</p>
                        ) : (
                          <div className="space-y-2">
                            {(participacoes[sol.id] || []).map((part) => (
                              <div
                                key={part.id}
                                className={`rounded-lg border p-3 ${
                                  part.quer_participar
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800"
                                    : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">{part.nome || "—"}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{part.email || "—"}</p>
                                    {part.telefone && <p className="text-xs text-gray-500 dark:text-gray-400">{part.telefone}</p>}
                                  </div>
                                  <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    part.quer_participar ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                  }`}>
                                    {part.quer_participar ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                                    {part.quer_participar ? "Quer participar" : "Sem interesse"}
                                  </span>
                                </div>
                                {part.mensagem && (
                                  <p className="mt-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-md p-2 whitespace-pre-wrap break-words">
                                    {part.mensagem}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Solicitante (visível apenas para admin) */}
                      {isAdmin && sol.usuario_id && (() => {
                        let solicitante = usuariosEmpresa.find(u => u.auth_user_id === sol.usuario_id || u.id === sol.usuario_id);
                        if (!solicitante && sol.usuario_id === usuario?.id) {
                          solicitante = { nome: usuario?.nome, email: usuario?.email };
                        }
                        if (!solicitante) return null;
                        return (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> Solicitado por
                            </p>
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-sm flex-shrink-0">
                                {solicitante.nome?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{solicitante.nome}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{solicitante.email}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Status (visível em mobile) */}
                      <div className="sm:hidden">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 font-medium uppercase tracking-wider">
                          Status
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.cor}`}
                        >
                          {statusInfo.icone}
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Linha do tempo de status */}
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 font-medium uppercase tracking-wider">
                          Progresso
                        </p>
                        <div className="flex items-center gap-0">
                          {(
                            [
                              { key: "pendente", label: "Recebida" },
                              { key: "em_andamento", label: "Em andamento" },
                              { key: "concluido", label: "Concluída" },
                            ] as const
                          ).map((etapa, idx) => {
                            const ordem = ["pendente", "em_andamento", "concluido", "cancelado"];
                            const idxAtual = ordem.indexOf(sol.status);
                            const idxEtapa = ordem.indexOf(etapa.key);
                            const ativa = idxAtual >= idxEtapa && sol.status !== "cancelado";
                            const ehAtual = sol.status === etapa.key;

                            return (
                              <div key={etapa.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-colors ${
                                      ativa
                                        ? "bg-[#7030A0] border-[#7030A0] text-white"
                                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400"
                                    } ${ehAtual ? "ring-4 ring-purple-200 dark:ring-purple-900/50" : ""}`}
                                  >
                                    {ativa ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                                  </div>
                                  <span className={`text-xs mt-1 font-medium whitespace-nowrap ${ativa ? "text-[#7030A0] dark:text-purple-400" : "text-gray-400"}`}>
                                    {etapa.label}
                                  </span>
                                </div>
                                {idx < 2 && (
                                  <div
                                    className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${
                                      idxAtual > idxEtapa && sol.status !== "cancelado"
                                        ? "bg-[#7030A0]"
                                        : "bg-gray-200 dark:bg-gray-600"
                                    }`}
                                  />
                                )}
                              </div>
                            );
                          })}
                          {sol.status === "cancelado" && (
                            <div className="ml-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Solicitação cancelada
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Descrição */}
                      {sol.descricao && (
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Detalhes informados
                          </p>
                          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {sol.descricao}
                          </div>
                        </div>
                      )}

                      {/* Empresas Indicadas */}
                      {sol.empresas_indicadas && sol.empresas_indicadas.length > 0 && (
                        <div>
                          <p className="text-xs text-[#7030A0] mb-2 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> Empreendedores Encontrados
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sol.empresas_indicadas.map((empId: string) => {
                              const emp = empresasDict[empId];
                              if (!emp) return null;
                              return (
                                <div key={empId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{emp.razao_social}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{emp.cnpj}</p>
                                    {emp.email && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{emp.email}</p>}
                                  </div>
                                  <Link href={`/empresas/${empId}`}>
                                    <a className="inline-flex flex-shrink-0 items-center justify-center px-4 py-2 text-xs font-medium text-white bg-[#7030A0] hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 rounded-lg transition-colors">
                                      Ver Detalhes
                                    </a>
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Documento */}
                      {sol.documento_url && (
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wider">
                            Documento anexado
                          </p>
                          <a
                            href={sol.documento_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Ver documento
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalSolicitarBusca
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        onSucesso={carregar} // Recarrega a lista ao enviar com sucesso
      />
    </LayoutUsuario>
  );
}
