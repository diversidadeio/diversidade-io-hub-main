import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  MapPin,
  Monitor,
  Users,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface SolicitacaoBusca {
  id: string;
  empresa_id: string;
  cnaes: string[];
  cidade: string;
  modalidade: "online" | "presencial" | "ambos";
  descricao: string | null;
  documento_url: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "cancelado";
  criado_em: string;
  // dados da empresa vinculada
  razao_social?: string;
  cnpj?: string;
  email_empresa?: string;
  nome_responsavel?: string;
  telefone_principal?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const ROTULOS_STATUS: Record<string, { label: string; cor: string; icone: React.ReactNode }> = {
  pendente:      { label: "Pendente",      cor: "bg-orange-100 text-orange-800",  icone: <Clock className="w-3 h-3" /> },
  em_andamento:  { label: "Em andamento",  cor: "bg-blue-100 text-blue-800",      icone: <Loader2 className="w-3 h-3 animate-spin" /> },
  concluido:     { label: "Concluído",     cor: "bg-green-100 text-green-800",    icone: <CheckCircle2 className="w-3 h-3" /> },
  cancelado:     { label: "Cancelado",     cor: "bg-gray-100 text-gray-700",      icone: <AlertCircle className="w-3 h-3" /> },
};

const ROTULOS_MODALIDADE: Record<string, string> = {
  online:      "🌐 Online",
  presencial:  "📍 Presencial",
  ambos:       "✅ Online e Presencial",
};

const STATUS_DISPONIVEIS = ["pendente", "em_andamento", "concluido", "cancelado"] as const;

// ── Componente principal ─────────────────────────────────────────────────────
export default function SolicitacoesAdm() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoBusca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<SolicitacaoBusca | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  // Carrega solicitações com dados das empresas via join manual
  async function carregarSolicitacoes() {
    setCarregando(true);
    try {
      const { data: solData, error } = await supabase
        .from("solicitacoes_busca")
        .select("*")
        .order("criado_em", { ascending: false });

      if (error) throw error;

      if (!solData || solData.length === 0) {
        setSolicitacoes([]);
        return;
      }

      // Busca dados das empresas
      const empresaIds = Array.from(new Set(solData.map((s: any) => s.empresa_id)));
      const { data: empresasData } = await supabase
        .from("empresas")
        .select("id, razao_social, cnpj, email, nome_responsavel, telefone_principal")
        .in("id", empresaIds);

      const empresaMap: Record<string, any> = {};
      (empresasData || []).forEach((e: any) => { empresaMap[e.id] = e; });

      const lista: SolicitacaoBusca[] = solData.map((s: any) => {
        const emp = empresaMap[s.empresa_id] || {};
        return {
          ...s,
          razao_social:       emp.razao_social || "—",
          cnpj:               emp.cnpj || "—",
          email_empresa:      emp.email || "—",
          nome_responsavel:   emp.nome_responsavel || "—",
          telefone_principal: emp.telefone_principal || "—",
        };
      });

      setSolicitacoes(lista);
    } catch (err: any) {
      console.error("Erro ao carregar solicitações de busca:", err);
      toast.error("Erro ao carregar solicitações.");
    } finally {
      setCarregando(false);
    }
  }

  // Atualiza o status de uma solicitação
  async function atualizarStatus(id: string, novoStatus: string) {
    setAtualizandoStatus(true);
    try {
      const { error } = await supabase
        .from("solicitacoes_busca")
        .update({ status: novoStatus })
        .eq("id", id);

      if (error) throw error;

      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: novoStatus as any } : s))
      );
      if (selecionada?.id === id) {
        setSelecionada((prev) => prev ? { ...prev, status: novoStatus as any } : null);
      }
      toast.success("Status atualizado com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + (err.message || "Tente novamente."));
    } finally {
      setAtualizandoStatus(false);
    }
  }

  // Filtragem local por status
  const solicitacoesFiltradas = filtroStatus === "todos"
    ? solicitacoes
    : solicitacoes.filter((s) => s.status === filtroStatus);

  return (
    <LayoutAdm>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Solicitações de Busca</h1>
            <p className="text-gray-600 mt-1">
              Solicitações de busca de empreendedores por CNAE enviadas por empresas incentivadoras.
            </p>
          </div>
          <button
            onClick={carregarSolicitacoes}
            disabled={carregando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {/* Filtros por status */}
        <div className="flex flex-wrap gap-2">
          {["todos", ...STATUS_DISPONIVEIS].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filtroStatus === s
                  ? "bg-[#7030A0] text-white border-[#7030A0]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "todos" ? "Todas" : ROTULOS_STATUS[s]?.label}
              {s !== "todos" && (
                <span className="ml-1.5 opacity-70">
                  ({solicitacoes.filter((x) => x.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {carregando ? (
          <div className="flex justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
          </div>
        ) : solicitacoesFiltradas.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma solicitação encontrada.</p>
            <p className="text-gray-400 text-sm mt-1">
              {filtroStatus !== "todos"
                ? `Não há solicitações com status "${ROTULOS_STATUS[filtroStatus]?.label}".`
                : "Ainda não foram enviadas solicitações de busca."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Data</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Empresa</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Responsável / Telefone</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">CNAEs</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Cidade</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Modalidade</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitacoesFiltradas.map((sol) => {
                  const statusInfo = ROTULOS_STATUS[sol.status];
                  return (
                    <tr key={sol.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                        {new Date(sol.criado_em).toLocaleDateString("pt-BR")}
                        <div className="text-xs text-gray-400">
                          {new Date(sol.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 truncate max-w-[200px]">{sol.razao_social}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{sol.email_empresa}</p>
                        <p className="text-xs text-gray-400">{sol.cnpj}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-gray-700">{sol.nome_responsavel}</p>
                        <p className="text-xs text-gray-400">{sol.telefone_principal}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          {sol.cnaes.map((cnae, i) => (
                            <span
                              key={i}
                              className="inline-block px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium"
                            >
                              {cnae}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{sol.cidade}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap text-xs">
                        {ROTULOS_MODALIDADE[sol.modalidade]}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.cor}`}>
                          {statusInfo.icone}
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelecionada(sol)}
                          className="border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de Detalhes ───────────────────────────────────────────────── */}
      <Dialog open={!!selecionada} onOpenChange={(open) => !open && setSelecionada(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="w-5 h-5 text-[#7030A0]" />
              Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>

          {selecionada && (
            <div className="space-y-5 py-1">

              {/* Empresa solicitante */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Empresa Solicitante
                </p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{selecionada.razao_social}</p>
                      <p className="text-sm text-gray-500">{selecionada.cnpj}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROTULOS_STATUS[selecionada.status].cor}`}>
                      {ROTULOS_STATUS[selecionada.status].icone}
                      {ROTULOS_STATUS[selecionada.status].label}
                    </span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Responsável</p>
                      <p className="text-gray-800 font-medium">{selecionada.nome_responsavel}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Telefone</p>
                      <p className="text-gray-800 font-medium">{selecionada.telefone_principal}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400 text-xs mb-0.5">E-mail</p>
                      <p className="text-gray-800 font-medium">{selecionada.email_empresa}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dados da solicitação */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Dados da Solicitação
                </p>
                <div className="space-y-4">

                  {/* CNAEs */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5 font-medium">CNAEs desejados</p>
                    <div className="flex flex-wrap gap-2">
                      {selecionada.cnaes.map((cnae, i) => (
                        <span key={i} className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium border border-purple-100">
                          {cnae}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Cidade e modalidade */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Cidade
                      </p>
                      <p className="text-gray-800 text-sm font-medium">{selecionada.cidade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-medium flex items-center gap-1">
                        <Monitor className="w-3 h-3" /> Modalidade
                      </p>
                      <p className="text-gray-800 text-sm font-medium">{ROTULOS_MODALIDADE[selecionada.modalidade]}</p>
                    </div>
                  </div>

                  {/* Descrição */}
                  {selecionada.descricao && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">Detalhes / Observações</p>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selecionada.descricao}
                      </div>
                    </div>
                  )}

                  {/* Documento */}
                  {selecionada.documento_url && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">Documento anexado</p>
                      <a
                        href={selecionada.documento_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir documento
                      </a>
                    </div>
                  )}

                  {/* Data */}
                  <div>
                    <p className="text-xs text-gray-400">
                      Solicitação enviada em{" "}
                      <span className="font-medium text-gray-600">
                        {new Date(selecionada.criado_em).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "long", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Atualizar status */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Atualizar Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_DISPONIVEIS.map((s) => (
                    <button
                      key={s}
                      disabled={selecionada.status === s || atualizandoStatus}
                      onClick={() => atualizarStatus(selecionada.id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        selecionada.status === s
                          ? "bg-[#7030A0] text-white border-[#7030A0]"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {atualizandoStatus && selecionada.status !== s ? (
                        <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                      ) : null}
                      {ROTULOS_STATUS[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </LayoutAdm>
  );
}
