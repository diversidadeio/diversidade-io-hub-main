import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Eye, FileText,
  MapPin, Monitor, Users, ExternalLink, RefreshCw,
  ChevronLeft, ChevronRight, SlidersHorizontal, X, Search, UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PORTES_DISPONIVEIS = ["MEI", "ME", "MICRO", "EPP", "Média Empresa", "Grande Empresa"];
const RACAS_DISPONIVEIS = ["Pardo", "Preto", "Branco", "Amarelo", "Indígena", "Outro"];
const SEXOS_DISPONIVEIS = ["Masculino", "Feminino", "Outro", "Prefiro não declarar"];

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
  atualizado_em?: string;
  // dados da empresa vinculada
  razao_social?: string;
  cnpj?: string;
  email_empresa?: string;
  nome_responsavel?: string;
  telefone_principal?: string;
  empresas_indicadas?: string[];
  responsavel_adm_ids?: string[];
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

export function getSlaInfo(dataCriacao: string, status: string) {
  if (status === 'concluido' || status === 'cancelado') return null;

  const inicio = new Date(dataCriacao);
  const hoje = new Date();
  
  // Zera as horas para comparar apenas os dias
  const d1 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const d2 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

  if (diffDays <= 2) {
    return { 
      cor: "bg-green-100 text-green-800 border-green-200", 
      texto: diffDays === 0 ? "No prazo (Hoje)" : `No prazo (${diffDays} ${diffDays === 1 ? 'dia' : 'dias'})` 
    };
  } else if (diffDays <= 5) {
    return { 
      cor: "bg-orange-100 text-orange-800 border-orange-200", 
      texto: `Atenção (${diffDays} dias)` 
    };
  } else {
    return { 
      cor: "bg-red-100 text-red-800 border-red-200", 
      texto: `Atrasado (${diffDays} dias)` 
    };
  }
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function SolicitacoesAdm() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoBusca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<SolicitacaoBusca | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  // Estados para os administradores responsáveis
  const [admins, setAdmins] = useState<any[]>([]);
  const [atualizandoResponsaveis, setAtualizandoResponsaveis] = useState(false);

  // Estados para as empresas indicadas
  const [empresasIndicadasList, setEmpresasIndicadasList] = useState<any[]>([]);
  const [termoBusca, setTermoBusca] = useState("");
  const [atualizandoIndicacoes, setAtualizandoIndicacoes] = useState(false);

  // --- LÓGICA COPIADA DE PESQUISAS PARA OS FILTROS DA BUSCA DE INDICAÇÃO ---
  const [todasEmpresas, setTodasEmpresas] = useState<any[]>([]);
  const [todosSocios, setTodosSocios] = useState<Record<string, any[]>>({});
  const [carregandoTodasEmpresas, setCarregandoTodasEmpresas] = useState(false);

  // Filtros
  const [modalFiltroAberto, setModalFiltroAberto] = useState(false);
  const FILTROS_PADRAO = { portes: [] as string[], completude: "todos", ordenacao: "recentes", etariedade_60: false, racas: [] as string[], sexos: [] as string[] };
  const [filtrosTemp, setFiltrosTemp] = useState(FILTROS_PADRAO);
  const [filtrosAtivos, setFiltrosAtivos] = useState(FILTROS_PADRAO);
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const porPagina = 10;

  useEffect(() => {
    carregarSolicitacoes();
    carregarTodasEmpresas();
    carregarAdmins();
  }, []);

  async function carregarTodasEmpresas() {
    setCarregandoTodasEmpresas(true);
    try {
      let query = supabase
        .from("empresas")
        .select("*")
        .eq('status_aprovacao', 'aprovado')
        .not('acesso_tipo', 'ilike', '%EMPRESA OU INICIATIVA INCENTIVADORA%');

      // Se houver uma solicitação selecionada, removemos a própria empresa que está pedindo a busca
      if (selecionada?.empresa_id) {
        query = query.neq('id', selecionada.empresa_id);
      }

      const { data: empData } = await query;
      const { data: socData } = await supabase.from("socios").select("*");
      
      const sociosMap: Record<string, any[]> = {};
      (socData || []).forEach(s => {
        if (!sociosMap[s.empresa_id]) sociosMap[s.empresa_id] = [];
        sociosMap[s.empresa_id].push(s);
      });
      setTodosSocios(sociosMap);
      setTodasEmpresas(empData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoTodasEmpresas(false);
    }
  }

  // Refaz a busca toda vez que abrir um modal diferente, para ignorar o solicitante atual
  useEffect(() => {
    if (selecionada) {
      carregarTodasEmpresas();
    }
  }, [selecionada?.id]);

  // Carrega lista de administradores da plataforma
  async function carregarAdmins() {
    try {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome_responsavel, email")
        .eq("tipo_usuario", "adm")
        .order("nome_responsavel", { ascending: true });
      setAdmins(data || []);
    } catch (err) {
      console.error("Erro ao carregar administradores:", err);
    }
  }

  // Util para completude
  function calcularCompletude(empresa: any, socios: any[]) {
    let preenchidos = 0;
    const CAMPOS_OBRIGATORIOS = ["razao_social", "cnpj", "nome_responsavel", "telefone_principal", "area_empresa", "sobre_empresa", "logo_empresa_url"];
    const CAMPOS_SOCIO = ["nome", "cpf", "email", "cep", "data_nascimento", "nacionalidade", "raca", "sexo"];
    
    CAMPOS_OBRIGATORIOS.forEach(c => { if (empresa[c]) preenchidos++; });
    let reqSocio = 0;
    let preSocio = 0;
    socios.forEach(s => {
      CAMPOS_SOCIO.forEach(c => {
        reqSocio++;
        if (s[c]) preSocio++;
      });
    });
    const totalSocio = reqSocio === 0 ? 1 : reqSocio;
    const valSocio = reqSocio === 0 ? 1 : preSocio;
    const completudeEmpresa = preenchidos / CAMPOS_OBRIGATORIOS.length;
    const completudeSocio = valSocio / totalSocio;
    return Math.round((completudeEmpresa * 0.5 + completudeSocio * 0.5) * 100);
  }

  const empresasFiltradas = (() => {
    let lista = todasEmpresas.filter(emp => {
      const termo = termoBusca.toLowerCase();
      const termoSemPontuacao = termo.replace(/[^\d]/g, '');
      const cnpjLimpo = emp.cnpj ? emp.cnpj.replace(/[^\d]/g, '') : '';

      const matchBusca = !termo || 
        (emp.razao_social && emp.razao_social.toLowerCase().includes(termo)) || 
        (emp.email && emp.email.toLowerCase().includes(termo)) || 
        (termoSemPontuacao && cnpjLimpo.includes(termoSemPontuacao));
      
      const matchPorte = filtrosAtivos.portes.length === 0 || filtrosAtivos.portes.includes(emp.porte_empresa);
      
      const listaSocios = todosSocios[emp.id] || [];
      const completude = calcularCompletude(emp, listaSocios);
      const matchCompletude = filtrosAtivos.completude === "todos" || 
        (filtrosAtivos.completude === "completo" && completude === 100) || 
        (filtrosAtivos.completude === "incompleto" && completude < 100);
      
      const matchEtariedade = !filtrosAtivos.etariedade_60 || listaSocios.some((s:any) => parseInt(s.etariedade) >= 60);
      const matchRaca = filtrosAtivos.racas.length === 0 || listaSocios.some((s:any) => filtrosAtivos.racas.includes(s.raca));
      const matchSexo = filtrosAtivos.sexos.length === 0 || listaSocios.some((s:any) => s.sexo && filtrosAtivos.sexos.some(fs => s.sexo.startsWith(fs)));
      
      const isAlreadyIndicated = selecionada?.empresas_indicadas?.includes(emp.id);

      return matchBusca && matchPorte && matchCompletude && matchEtariedade && matchRaca && matchSexo && !isAlreadyIndicated;
    });

    lista = [...lista].sort((a, b) => {
      if (filtrosAtivos.ordenacao === "antigos") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (filtrosAtivos.ordenacao === "nome_az") return (a.razao_social || "").localeCompare(b.razao_social || "");
      if (filtrosAtivos.ordenacao === "nome_za") return (b.razao_social || "").localeCompare(a.razao_social || "");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return lista;
  })();

  const totalResultados = empresasFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalResultados / porPagina));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  const resultadosBuscaPagina = empresasFiltradas.slice(inicio, inicio + porPagina);

  useEffect(() => { setPaginaAtual(1); }, [termoBusca, filtrosAtivos, selecionada]);

  // Carrega empresas indicadas ao abrir modal
  useEffect(() => {
    async function carregarIndicadas() {
      if (!selecionada || !selecionada.empresas_indicadas || selecionada.empresas_indicadas.length === 0) {
        setEmpresasIndicadasList([]);
        return;
      }
      try {
        const { data } = await supabase
          .from("empresas")
          .select("id, razao_social, cnpj, email")
          .in("id", selecionada.empresas_indicadas);
        setEmpresasIndicadasList(data || []);
      } catch (err) {
        console.error("Erro ao carregar empresas indicadas", err);
      }
    }
    carregarIndicadas();
    setTermoBusca("");
  }, [selecionada]);

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

  // Adicionar e Remover empresas indicadas
  async function adicionarIndicacao(empresa: any) {
    if (!selecionada || atualizandoIndicacoes) return;
    setAtualizandoIndicacoes(true);
    try {
      const novaLista = [...(selecionada.empresas_indicadas || []), empresa.id];
      
      const { error } = await supabase
        .from("solicitacoes_busca")
        .update({ empresas_indicadas: novaLista })
        .eq("id", selecionada.id);
        
      if (error) throw error;

      setSelecionada({ ...selecionada, empresas_indicadas: novaLista });
      setSolicitacoes((prev) => prev.map(s => s.id === selecionada.id ? { ...s, empresas_indicadas: novaLista } : s));
      setEmpresasIndicadasList((prev) => [...prev, empresa]);
      toast.success("Empresa adicionada à solicitação.");
    } catch (err: any) {
      toast.error("Erro ao adicionar empresa: " + err.message);
    } finally {
      setAtualizandoIndicacoes(false);
    }
  }

  async function removerIndicacao(empresaId: string) {
    if (!selecionada || atualizandoIndicacoes) return;
    setAtualizandoIndicacoes(true);
    try {
      const novaLista = (selecionada.empresas_indicadas || []).filter(id => id !== empresaId);
      
      const { error } = await supabase
        .from("solicitacoes_busca")
        .update({ empresas_indicadas: novaLista })
        .eq("id", selecionada.id);
        
      if (error) throw error;

      setSelecionada({ ...selecionada, empresas_indicadas: novaLista });
      setSolicitacoes((prev) => prev.map(s => s.id === selecionada.id ? { ...s, empresas_indicadas: novaLista } : s));
      setEmpresasIndicadasList((prev) => prev.filter(e => e.id !== empresaId));
      toast.success("Empresa removida da solicitação.");
    } catch (err: any) {
      toast.error("Erro ao remover empresa: " + err.message);
    } finally {
      setAtualizandoIndicacoes(false);
    }
  }

  // Adicionar e Remover administradores responsáveis
  async function adicionarResponsavel(admId: string) {
    if (!selecionada || atualizandoResponsaveis) return;
    setAtualizandoResponsaveis(true);
    try {
      const novaLista = [...(selecionada.responsavel_adm_ids || []), admId];

      const { error } = await supabase
        .from("solicitacoes_busca")
        .update({ responsavel_adm_ids: novaLista })
        .eq("id", selecionada.id);

      if (error) throw error;

      setSelecionada({ ...selecionada, responsavel_adm_ids: novaLista });
      setSolicitacoes((prev) => prev.map(s => s.id === selecionada.id ? { ...s, responsavel_adm_ids: novaLista } : s));
      toast.success("Administrador atribuído com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao atribuir administrador: " + err.message);
    } finally {
      setAtualizandoResponsaveis(false);
    }
  }

  async function removerResponsavel(admId: string) {
    if (!selecionada || atualizandoResponsaveis) return;
    setAtualizandoResponsaveis(true);
    try {
      const novaLista = (selecionada.responsavel_adm_ids || []).filter(id => id !== admId);

      const { error } = await supabase
        .from("solicitacoes_busca")
        .update({ responsavel_adm_ids: novaLista })
        .eq("id", selecionada.id);

      if (error) throw error;

      setSelecionada({ ...selecionada, responsavel_adm_ids: novaLista });
      setSolicitacoes((prev) => prev.map(s => s.id === selecionada.id ? { ...s, responsavel_adm_ids: novaLista } : s));
      toast.success("Administrador removido com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao remover administrador: " + err.message);
    } finally {
      setAtualizandoResponsaveis(false);
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
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">CNAEs</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Cidade</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Modalidade</th>
                  <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Prazo</th>
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
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-xs font-semibold whitespace-nowrap">
                          {sol.cnaes.length} {sol.cnaes.length === 1 ? 'CNAE' : 'CNAEs'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{sol.cidade}</td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap text-xs">
                        {ROTULOS_MODALIDADE[sol.modalidade]}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {(() => {
                          const sla = getSlaInfo(sol.criado_em, sol.status);
                          if (!sla) return <span className="text-xs text-gray-400">—</span>;
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sla.cor}`}>
                              {sla.texto}
                            </span>
                          );
                        })()}
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
                    <p className="text-xs text-gray-400 mb-2">
                      Solicitação enviada em{" "}
                      <span className="font-medium text-gray-600">
                        {new Date(selecionada.criado_em).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "long", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </p>
                    {(() => {
                      const sla = getSlaInfo(selecionada.criado_em, selecionada.status);
                      if (!sla) return null;
                      return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${sla.cor}`}>
                          SLA: {sla.texto}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Responsáveis pela solicitação */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Responsáveis pela Solicitação
                </p>

                {/* Admins já atribuídos */}
                {(selecionada.responsavel_adm_ids || []).length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {(selecionada.responsavel_adm_ids || []).map((admId) => {
                      const adm = admins.find(a => a.id === admId);
                      if (!adm) return null;
                      return (
                        <div key={admId} className="flex items-center justify-between gap-2 p-2.5 bg-purple-50 border border-purple-100 rounded-lg">
                          <div>
                            <p className="text-sm font-semibold text-purple-900">{adm.nome_responsavel || "—"}</p>
                            <p className="text-xs text-purple-600">{adm.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                            onClick={() => removerResponsavel(admId)}
                            disabled={atualizandoResponsaveis}
                          >
                            {atualizandoResponsaveis ? <Loader2 className="w-3 h-3 animate-spin" /> : "Remover"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">Nenhum responsável atribuído.</p>
                )}

                {/* Admins disponíveis para atribuir */}
                {admins.filter(a => !(selecionada.responsavel_adm_ids || []).includes(a.id)).length > 0 && (
                  <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500 font-medium mb-2">Atribuir administrador:</p>
                    {admins
                      .filter(a => !(selecionada.responsavel_adm_ids || []).includes(a.id))
                      .map((adm) => (
                        <div key={adm.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{adm.nome_responsavel || "—"}</p>
                            <p className="text-xs text-gray-500">{adm.email}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 border-[#7030A0] text-[#7030A0] hover:bg-[#7030A0] hover:text-white text-xs transition-colors"
                            onClick={() => adicionarResponsavel(adm.id)}
                            disabled={atualizandoResponsaveis}
                          >
                            {atualizandoResponsaveis ? <Loader2 className="w-3 h-3 animate-spin" /> : "+ Atribuir"}
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
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

              <Separator />

              {/* Indicar Empresas */}
              <div>
                <p className="text-xs font-semibold text-[#7030A0] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Indicar Empresas
                </p>
                
                {/* Lista de indicadas */}
                {empresasIndicadasList.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Empresas já indicadas ({empresasIndicadasList.length}):</p>
                    {empresasIndicadasList.map((emp) => (
                      <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-green-900">{emp.razao_social}</p>
                          <p className="text-xs text-green-700">{emp.cnpj} • {emp.email}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 sm:w-auto w-full"
                          onClick={() => removerIndicacao(emp.id)}
                          disabled={atualizandoIndicacoes}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Busca para indicar novas */}
                <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-gray-500 font-medium">Buscar empresas para indicar:</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Buscar empresa, CNPJ ou e-mail..."
                          value={termoBusca}
                          onChange={(e) => setTermoBusca(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setFiltrosTemp(filtrosAtivos);
                          setModalFiltroAberto(true);
                        }}
                        className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          JSON.stringify(filtrosAtivos) !== JSON.stringify(FILTROS_PADRAO)
                            ? "bg-[#7030A0] text-white border-[#7030A0]"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filtros
                      </button>
                    </div>

                    {JSON.stringify(filtrosAtivos) !== JSON.stringify(FILTROS_PADRAO) && (
                      <button
                        onClick={() => { setFiltrosAtivos(FILTROS_PADRAO); setPaginaAtual(1); }}
                        className="text-xs text-[#7030A0] hover:text-purple-800 text-left font-medium underline"
                      >
                        Limpar filtros ativos
                      </button>
                    )}
                  </div>

                  {carregandoTodasEmpresas ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="w-5 h-5 animate-spin text-[#7030A0]" />
                    </div>
                  ) : resultadosBuscaPagina.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">Nenhuma empresa encontrada com os filtros atuais.</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {resultadosBuscaPagina.map((emp) => (
                        <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{emp.razao_social}</p>
                            <p className="text-xs text-gray-500">{emp.cnpj}</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 border-[#7030A0] text-[#7030A0] hover:bg-[#7030A0] hover:text-white sm:w-auto w-full transition-colors"
                            onClick={() => adicionarIndicacao(emp)}
                            disabled={atualizandoIndicacoes}
                          >
                            + Indicar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Paginação */}
                  {!carregandoTodasEmpresas && totalPaginas > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                      <span className="text-xs text-gray-500">
                        {inicio + 1} - {Math.min(inicio + porPagina, totalResultados)} de {totalResultados}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                          className="p-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="p-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal de Filtros ───────────────────────────────────────────────────── */}
      <Dialog open={modalFiltroAberto} onOpenChange={setModalFiltroAberto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <SlidersHorizontal className="w-5 h-5 text-[#7030A0]" />
              Filtros de Empresas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Porte */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Porte da Empresa</p>
              <div className="grid grid-cols-2 gap-2">
                {PORTES_DISPONIVEIS.map((porte) => (
                  <div key={porte} className="flex items-center gap-2">
                    <Checkbox
                      id={`porte-${porte}`}
                      checked={filtrosTemp.portes.includes(porte)}
                      onCheckedChange={(checked) => {
                        setFiltrosTemp((p) => ({
                          ...p,
                          portes: checked ? [...p.portes, porte] : p.portes.filter((x) => x !== porte),
                        }));
                      }}
                    />
                    <Label htmlFor={`porte-${porte}`} className="text-sm cursor-pointer">{porte}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Completude */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Preenchimento do Cadastro</p>
              <div className="flex gap-2 flex-wrap">
                {(["todos", "completo", "incompleto"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, completude: c }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.completude === c ? "bg-[#7030A0] text-white border-[#7030A0]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {c === "todos" ? "Todos" : c === "completo" ? "Completo" : "Incompleto"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Ordenação */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Ordenação</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "recentes", label: "Mais recentes" },
                    { value: "antigos", label: "Mais antigos" },
                    { value: "nome_az", label: "Nome A→Z" },
                    { value: "nome_za", label: "Nome Z→A" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, ordenacao: value }))}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                      filtrosTemp.ordenacao === value ? "bg-[#7030A0] text-white border-[#7030A0]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Perfil dos Sócios</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="etariedade_60"
                  checked={filtrosTemp.etariedade_60}
                  onCheckedChange={(checked) => setFiltrosTemp((p) => ({ ...p, etariedade_60: !!checked }))}
                />
                <Label htmlFor="etariedade_60" className="text-sm cursor-pointer">Possui sócios 60+</Label>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Raça/Cor</p>
                <div className="grid grid-cols-2 gap-2">
                  {RACAS_DISPONIVEIS.map((raca) => (
                    <div key={raca} className="flex items-center gap-2">
                      <Checkbox
                        id={`raca-${raca}`}
                        checked={filtrosTemp.racas.includes(raca)}
                        onCheckedChange={(checked) => setFiltrosTemp((p) => ({ ...p, racas: checked ? [...p.racas, raca] : p.racas.filter((x) => x !== raca) }))}
                      />
                      <Label htmlFor={`raca-${raca}`} className="text-sm cursor-pointer">{raca}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Identidade de Gênero</p>
                <div className="grid grid-cols-2 gap-2">
                  {SEXOS_DISPONIVEIS.map((sexo) => (
                    <div key={sexo} className="flex items-center gap-2">
                      <Checkbox
                        id={`sexo-${sexo}`}
                        checked={filtrosTemp.sexos.includes(sexo)}
                        onCheckedChange={(checked) => setFiltrosTemp((p) => ({ ...p, sexos: checked ? [...p.sexos, sexo] : p.sexos.filter((x) => x !== sexo) }))}
                      />
                      <Label htmlFor={`sexo-${sexo}`} className="text-sm cursor-pointer">{sexo}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-row justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setFiltrosTemp(FILTROS_PADRAO)} className="flex-1">Limpar</Button>
            <Button onClick={() => { setFiltrosAtivos(filtrosTemp); setModalFiltroAberto(false); setPaginaAtual(1); }} className="flex-1 bg-[#7030A0] text-white hover:bg-purple-800">Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutAdm>
  );
}
