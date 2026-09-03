import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Eye, FileText,
  MapPin, Monitor, Users, ExternalLink, RefreshCw,
  ChevronLeft, ChevronRight, SlidersHorizontal, X, Search, UserCheck,
  Link2, Copy, Check, CalendarClock, MessageSquare, ThumbsUp, ThumbsDown,
  Save, EyeOff, Send as SendIcon
} from "lucide-react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  montarLinkOportunidade, copiarParaAreaDeTransferencia,
  mensagemCompartilhamento, infoPrazo, tituloOportunidade,
} from "@/lib/oportunidade";

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
  // campos da página compartilhável (/oportunidades/:id)
  titulo?: string | null;
  prazo_final?: string | null;
  compartilhavel?: boolean;
}

/** Quem abriu o link compartilhado. */
interface VisualizacaoOportunidade {
  id: string;
  nome: string | null;
  email: string | null;
  empresa_id: string | null;
  criado_em: string;
}

/** Quem respondeu se quer ou não participar. */
interface ParticipacaoOportunidade {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  empresa_id: string | null;
  quer_participar: boolean;
  mensagem: string | null;
  criado_em: string;
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

import { ModalNovaSolicitacaoAdm } from "@/components/adm/ModalNovaSolicitacaoAdm";

// ── Componente principal ─────────────────────────────────────────────────────
export default function SolicitacoesAdm() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoBusca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<SolicitacaoBusca | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [modalCriacaoAberto, setModalCriacaoAberto] = useState(false);
  const [solicitacaoParaDeletar, setSolicitacaoParaDeletar] = useState<SolicitacaoBusca | null>(null);
  const [deletando, setDeletando] = useState(false);

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

  // Link compartilhável, alcance e edição de título/prazo
  const [metricas, setMetricas] = useState<{
    visualizacoes: VisualizacaoOportunidade[];
    participacoes: ParticipacaoOportunidade[];
  }>({ visualizacoes: [], participacoes: [] });
  const [carregandoMetricas, setCarregandoMetricas] = useState(false);
  const [resumoPorSolicitacao, setResumoPorSolicitacao] = useState<Record<string, { cliques: number; interessados: number }>>({});
  const [idCopiado, setIdCopiado] = useState<string | null>(null);
  const [tituloEdit, setTituloEdit] = useState("");
  const [prazoEdit, setPrazoEdit] = useState("");
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);

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
    const CAMPOS_OBRIGATORIOS = ["razao_social", "cnpj", "nome_responsavel", "telefone_principal", "area_empresa", "sobre_empresa"];
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

  // ── Link compartilhável ───────────────────────────────────────────────────

  /** Copia o link da oportunidade e dá um feedback visual de 2s no botão. */
  async function copiarLink(sol: SolicitacaoBusca, comTexto = false) {
    const link = montarLinkOportunidade(sol.id);
    const conteudo = comTexto ? mensagemCompartilhamento(sol, link) : link;
    const ok = await copiarParaAreaDeTransferencia(conteudo);
    if (!ok) {
      toast.error("Não foi possível copiar. Copie manualmente: " + link);
      return;
    }
    setIdCopiado(sol.id);
    setTimeout(() => setIdCopiado((atual) => (atual === sol.id ? null : atual)), 2000);
    toast.success(comTexto ? "Mensagem com o link copiada!" : "Link copiado!");
  }

  /** Ativa/desativa o link público sem apagar a solicitação. */
  async function alternarCompartilhamento(sol: SolicitacaoBusca) {
    const novoValor = !(sol.compartilhavel ?? true);
    try {
      const { error } = await supabase
        .from("solicitacoes_busca")
        .update({ compartilhavel: novoValor })
        .eq("id", sol.id);
      if (error) throw error;

      setSolicitacoes((prev) => prev.map((x) => (x.id === sol.id ? { ...x, compartilhavel: novoValor } : x)));
      setSelecionada((prev) => (prev && prev.id === sol.id ? { ...prev, compartilhavel: novoValor } : prev));
      toast.success(novoValor ? "Link reativado." : "Link desativado — quem abrir verá um aviso.");
    } catch (err: any) {
      toast.error("Erro ao alterar o compartilhamento: " + err.message);
    }
  }

  /** Salva o título exibido na página compartilhada e o prazo final. */
  async function salvarTituloPrazo() {
    if (!selecionada || salvandoDetalhes) return;
    setSalvandoDetalhes(true);
    try {
      const dados = {
        titulo: tituloEdit.trim() || null,
        prazo_final: prazoEdit || null,
      };
      const { error } = await supabase
        .from("solicitacoes_busca")
        .update(dados)
        .eq("id", selecionada.id);
      if (error) throw error;

      setSelecionada({ ...selecionada, ...dados });
      setSolicitacoes((prev) => prev.map((x) => (x.id === selecionada.id ? { ...x, ...dados } : x)));
      toast.success("Título e prazo atualizados.");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvandoDetalhes(false);
    }
  }

  /** Carrega cliques e manifestações de interesse da solicitação aberta. */
  async function carregarMetricas(solicitacaoId: string) {
    setCarregandoMetricas(true);
    try {
      const [{ data: views }, { data: parts }] = await Promise.all([
        supabase
          .from("solicitacao_visualizacoes")
          .select("id, nome, email, empresa_id, criado_em")
          .eq("solicitacao_id", solicitacaoId)
          .order("criado_em", { ascending: false }),
        supabase
          .from("solicitacao_participacoes")
          .select("id, nome, email, telefone, empresa_id, quer_participar, mensagem, criado_em")
          .eq("solicitacao_id", solicitacaoId)
          .order("criado_em", { ascending: false }),
      ]);
      setMetricas({ visualizacoes: views || [], participacoes: parts || [] });
    } catch (err) {
      console.error("Erro ao carregar métricas da oportunidade:", err);
      setMetricas({ visualizacoes: [], participacoes: [] });
    } finally {
      setCarregandoMetricas(false);
    }
  }

  /** Totais por solicitação, exibidos direto na listagem. */
  async function carregarResumoMetricas(ids: string[]) {
    if (ids.length === 0) { setResumoPorSolicitacao({}); return; }
    try {
      const [{ data: views }, { data: parts }] = await Promise.all([
        supabase.from("solicitacao_visualizacoes").select("solicitacao_id").in("solicitacao_id", ids),
        supabase.from("solicitacao_participacoes").select("solicitacao_id, quer_participar").in("solicitacao_id", ids),
      ]);

      const resumo: Record<string, { cliques: number; interessados: number }> = {};
      ids.forEach((id) => { resumo[id] = { cliques: 0, interessados: 0 }; });
      (views || []).forEach((v: any) => { if (resumo[v.solicitacao_id]) resumo[v.solicitacao_id].cliques++; });
      (parts || []).forEach((p: any) => {
        if (resumo[p.solicitacao_id] && p.quer_participar) resumo[p.solicitacao_id].interessados++;
      });
      setResumoPorSolicitacao(resumo);
    } catch (err) {
      console.error("Erro ao carregar resumo de métricas:", err);
    }
  }

  // Ao abrir o modal, sincroniza os campos editáveis e busca o alcance do link
  useEffect(() => {
    if (!selecionada) {
      setMetricas({ visualizacoes: [], participacoes: [] });
      return;
    }
    setTituloEdit(selecionada.titulo || "");
    setPrazoEdit(selecionada.prazo_final ? selecionada.prazo_final.slice(0, 10) : "");
    carregarMetricas(selecionada.id);
  }, [selecionada?.id]);

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
      carregarResumoMetricas(lista.map((s) => s.id));
    } catch (err: any) {
      console.error("Erro ao carregar solicitações de busca:", err);
      toast.error("Erro ao carregar solicitações.");
    } finally {
      setCarregando(false);
    }
  }

  // Exclui uma solicitação e notifica o usuário
  async function excluirSolicitacao() {
    if (!solicitacaoParaDeletar) return;
    setDeletando(true);
    try {
      const { error } = await supabase
        .from("solicitacoes_busca")
        .delete()
        .eq("id", solicitacaoParaDeletar.id);
        
      if (error) throw error;
      
      // Remove localmente
      setSolicitacoes(prev => prev.filter(s => s.id !== solicitacaoParaDeletar.id));
      if (selecionada?.id === solicitacaoParaDeletar.id) {
        setSelecionada(null);
      }
      
      // Envia notificação
      fetch('/api/enviar-email-exclusao-solicitacao-busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailDestino: solicitacaoParaDeletar.email_empresa,
          nomeEmpresa: solicitacaoParaDeletar.razao_social,
          cnaes: solicitacaoParaDeletar.cnaes,
          modalidade: solicitacaoParaDeletar.modalidade
        })
      }).catch(err => console.error("Erro ao enviar email de exclusão:", err));
      
      toast.success("Solicitação excluída com sucesso.");
      setSolicitacaoParaDeletar(null);
    } catch (err: any) {
      toast.error("Erro ao excluir solicitação: " + err.message);
    } finally {
      setDeletando(false);
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


  // Filtragem local por status e por responsável
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");

  const solicitacoesFiltradas = solicitacoes.filter((s) => {
    const matchStatus = filtroStatus === "todos" || s.status === filtroStatus;
    const matchResponsavel =
      filtroResponsavel === "todos"
        ? true
        : filtroResponsavel === "sem_responsavel"
        ? !s.responsavel_adm_ids || s.responsavel_adm_ids.length === 0
        : (s.responsavel_adm_ids || []).includes(filtroResponsavel);
    return matchStatus && matchResponsavel;
  });

  return (
    <LayoutAdm>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Solicitações de Busca</h1>
            <p className="text-gray-600 mt-1">
              Solicitações de busca de empreendedores por CNAE enviadas por empresas incentivadoras.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalCriacaoAberto(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7030A0] text-white hover:bg-purple-800 text-sm font-medium transition-colors shadow-sm"
            >
              <span className="text-lg font-medium leading-none mb-[2px]">+</span>
              Nova Solicitação
            </button>
            <button
              onClick={carregarSolicitacoes}
              disabled={carregando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Filtros por status + responsável */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Filtro de status */}
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

          {/* Filtro por responsável */}
          {admins.length > 0 && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className={`pl-3 pr-8 py-1.5 rounded-lg text-xs font-medium border transition-colors appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 ${
                  filtroResponsavel !== "todos"
                    ? "bg-[#7030A0] text-white border-[#7030A0]"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <option value="todos">Todos os responsáveis</option>
                <option value="sem_responsavel">Sem responsável</option>
                {admins.map((adm) => (
                  <option key={adm.id} value={adm.id}>
                    {adm.nome_responsavel || adm.email}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              {filtroStatus !== "todos" || filtroResponsavel !== "todos"
                ? "Nenhuma solicitação corresponde aos filtros selecionados."
                : "Ainda não foram enviadas solicitações de busca."}
            </p>
          </div>
        ) : (
          <>
            {/* Listagem em tabela — a partir de lg */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Data</th>
                    <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Empresa</th>
                    <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Cidade</th>
                    <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Prazo</th>
                    <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Alcance</th>
                    <th className="px-5 py-4 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 font-semibold text-gray-700 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {solicitacoesFiltradas.map((sol) => {
                    const statusInfo = ROTULOS_STATUS[sol.status];
                    const prazo = infoPrazo(sol.prazo_final);
                    const sla = getSlaInfo(sol.criado_em, sol.status);
                    const resumo = resumoPorSolicitacao[sol.id];
                    return (
                      <tr key={sol.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(sol.criado_em).toLocaleDateString("pt-BR")}
                          <div className="text-xs text-gray-400">
                            {new Date(sol.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 truncate max-w-[220px]">{sol.razao_social}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[220px]">{sol.email_empresa}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-semibold whitespace-nowrap">
                              {sol.cnaes.length} {sol.cnaes.length === 1 ? "CNAE" : "CNAEs"}
                            </span>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              {ROTULOS_MODALIDADE[sol.modalidade]}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{sol.cidade}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {prazo ? (
                            <>
                              <p className="text-xs font-medium text-gray-700">{prazo.data}</p>
                              <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${prazo.cor}`}>
                                {prazo.texto}
                              </span>
                            </>
                          ) : sla ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sla.cor}`}>
                              {sla.texto}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs text-gray-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                              {resumo ? resumo.cliques : 0} {resumo && resumo.cliques === 1 ? "clique" : "cliques"}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${resumo && resumo.interessados > 0 ? "text-green-700" : "text-gray-400"}`}>
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {resumo ? resumo.interessados : 0} interessados
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.cor}`}>
                            {statusInfo.icone}
                            {statusInfo.label}
                          </span>
                          {sol.compartilhavel === false ? (
                            <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                              <EyeOff className="w-3 h-3" /> link desativado
                            </span>
                          ) : prazo?.encerrado ? (
                            <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                              <EyeOff className="w-3 h-3" /> link encerrado pelo prazo
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copiarLink(sol)}
                              className="border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
                              title="Copiar link compartilhável"
                            >
                              {idCopiado === sol.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Link2 className="w-3.5 h-3.5" />}
                              {idCopiado === sol.id ? "Copiado" : "Link"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelecionada(sol)}
                              className="border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detalhes
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSolicitacaoParaDeletar(sol)}
                              className="border-red-200 text-red-600 hover:bg-red-50 flex items-center p-2"
                              title="Excluir solicitação"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Listagem em cartões — mobile e tablet */}
            <div className="lg:hidden space-y-3">
              {solicitacoesFiltradas.map((sol) => {
                const statusInfo = ROTULOS_STATUS[sol.status];
                const prazo = infoPrazo(sol.prazo_final);
                const sla = getSlaInfo(sol.criado_em, sol.status);
                const resumo = resumoPorSolicitacao[sol.id];
                return (
                  <div key={sol.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm break-words">{sol.razao_social}</p>
                        <p className="text-xs text-gray-400 break-all">{sol.email_empresa}</p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusInfo.cor}`}>
                        {statusInfo.icone}
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" /> {sol.cidade}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Monitor className="w-3.5 h-3.5 text-gray-400" /> {ROTULOS_MODALIDADE[sol.modalidade]}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-semibold">
                        {sol.cnaes.length} {sol.cnaes.length === 1 ? "CNAE" : "CNAEs"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {prazo ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${prazo.cor}`}>
                          <CalendarClock className="w-3 h-3" /> {prazo.data} · {prazo.texto}
                        </span>
                      ) : sla ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sla.cor}`}>
                          {sla.texto}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                        <Eye className="w-3.5 h-3.5" /> {resumo ? resumo.cliques : 0}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${resumo && resumo.interessados > 0 ? "text-green-700" : "text-gray-400"}`}>
                        <ThumbsUp className="w-3.5 h-3.5" /> {resumo ? resumo.interessados : 0}
                      </span>
                      <span className="text-[11px] text-gray-400 ml-auto">
                        {new Date(sol.criado_em).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copiarLink(sol)}
                        className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                      >
                        {idCopiado === sol.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Link2 className="w-3.5 h-3.5" />}
                        {idCopiado === sol.id ? "Copiado" : "Copiar link"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setSelecionada(sol)}
                        className="flex-1 bg-[#7030A0] hover:bg-purple-800 text-white flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detalhes
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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

              {/* Link compartilhável */}
              <div>
                <p className="text-xs font-semibold text-[#7030A0] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Link Compartilhável
                </p>

                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={montarLinkOportunidade(selecionada.id)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-purple-200 bg-white text-xs text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <Button
                      size="sm"
                      onClick={() => copiarLink(selecionada)}
                      className="bg-[#7030A0] hover:bg-purple-800 text-white flex items-center gap-1.5 flex-shrink-0"
                    >
                      {idCopiado === selecionada.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {idCopiado === selecionada.id ? "Copiado" : "Copiar"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => copiarLink(selecionada, true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">Copiar texto</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(mensagemCompartilhamento(selecionada, montarLinkOportunidade(selecionada.id)))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <SendIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">WhatsApp</span>
                    </a>
                    <a
                      href={montarLinkOportunidade(selecionada.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">Abrir página</span>
                    </a>
                  </div>

                  <div className="flex items-start justify-between gap-3 border-t border-purple-100 pt-3">
                    <div>
                      {(() => {
                        const prazo = infoPrazo(selecionada.prazo_final);
                        const desativadoManualmente = (selecionada.compartilhavel ?? true) === false;
                        // O prazo final encerra o link automaticamente, mesmo com o link ativo
                        if (prazo?.encerrado && !desativadoManualmente) {
                          return (
                            <>
                              <p className="text-xs font-semibold text-gray-700">
                                Link encerrado pelo prazo ({prazo.data})
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                A página não abre mais. Para reabrir, altere o prazo final acima para uma data futura.
                              </p>
                            </>
                          );
                        }
                        return (
                          <>
                            <p className="text-xs font-semibold text-gray-700">
                              {desativadoManualmente ? "Link desativado" : "Link ativo"}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {desativadoManualmente
                                ? "Quem abrir o link verá um aviso de que o compartilhamento foi encerrado."
                                : prazo
                                ? `Qualquer usuário logado consegue abrir até ${prazo.data}.`
                                : "Qualquer usuário logado na plataforma consegue abrir esta página."}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => alternarCompartilhamento(selecionada)}
                      className="flex-shrink-0 h-8 text-xs border-gray-200 text-gray-600 hover:bg-white"
                    >
                      {(selecionada.compartilhavel ?? true) ? (
                        <><EyeOff className="w-3.5 h-3.5 mr-1.5" /> Desativar</>
                      ) : (
                        <><Eye className="w-3.5 h-3.5 mr-1.5" /> Reativar</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Título e prazo exibidos na página compartilhada */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" /> Título e Prazo da Página
                </p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Título exibido no link</Label>
                    <Input
                      value={tituloEdit}
                      onChange={(e) => setTituloEdit(e.target.value)}
                      placeholder={tituloOportunidade(selecionada)}
                      className="h-10"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Se ficar vazio, o título é gerado a partir dos CNAEs e da cidade.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Prazo final para manifestar interesse</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="date"
                        value={prazoEdit}
                        onChange={(e) => setPrazoEdit(e.target.value)}
                        className="h-10 flex-1"
                      />
                      <Button
                        onClick={salvarTituloPrazo}
                        disabled={salvandoDetalhes}
                        className="bg-[#7030A0] hover:bg-purple-800 text-white flex items-center gap-1.5 flex-shrink-0"
                      >
                        {salvandoDetalhes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                      </Button>
                    </div>
                    {(() => {
                      const prazo = infoPrazo(selecionada.prazo_final);
                      if (!prazo) return <p className="text-[11px] text-gray-400 mt-1">Sem prazo definido — o link fica aberto por tempo indeterminado.</p>;
                      return (
                        <>
                          <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded text-[10px] font-semibold border ${prazo.cor}`}>
                            {prazo.data} · {prazo.texto}
                          </span>
                          <p className="text-[11px] text-gray-400 mt-1.5">
                            Depois desta data o link deixa de abrir automaticamente.
                          </p>
                        </>
                      );
                    })()}
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

              {/* Alcance do link compartilhado */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Alcance do Link
                </p>

                {carregandoMetricas ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[#7030A0]" />
                  </div>
                ) : (
                  <>
                    {/* Números */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-center">
                        <p className="text-xl font-bold text-gray-900">{metricas.visualizacoes.length}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">cliques</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-center">
                        <p className="text-xl font-bold text-gray-900">
                          {new Set(metricas.visualizacoes.map((v) => v.email || v.id)).size}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">pessoas</p>
                      </div>
                      <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-3 text-center">
                        <p className="text-xl font-bold text-green-700">
                          {metricas.participacoes.filter((x) => x.quer_participar).length}
                        </p>
                        <p className="text-[11px] text-green-700 mt-0.5">querem participar</p>
                      </div>
                    </div>

                    {/* Quem pediu para participar */}
                    <p className="text-xs text-gray-500 font-medium mb-2">Respostas recebidas</p>
                    {metricas.participacoes.length === 0 ? (
                      <p className="text-xs text-gray-400 mb-4">Ninguém respondeu ainda.</p>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {metricas.participacoes.map((part) => (
                          <div
                            key={part.id}
                            className={`rounded-lg border p-3 ${part.quer_participar ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 break-words">{part.nome || "—"}</p>
                                <p className="text-xs text-gray-500 break-all">{part.email || "—"}</p>
                                {part.telefone && <p className="text-xs text-gray-500">{part.telefone}</p>}
                              </div>
                              <span
                                className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  part.quer_participar ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
                                }`}
                              >
                                {part.quer_participar ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                                {part.quer_participar ? "Quer participar" : "Sem interesse"}
                              </span>
                            </div>
                            {part.mensagem && (
                              <p className="mt-2 text-xs text-gray-700 bg-white border border-gray-100 rounded-md p-2 whitespace-pre-wrap break-words">
                                {part.mensagem}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-2">
                              {new Date(part.criado_em).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quem abriu o link */}
                    <p className="text-xs text-gray-500 font-medium mb-2">Quem abriu o link</p>
                    {metricas.visualizacoes.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhum clique registrado até agora.</p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
                        {metricas.visualizacoes.map((visu) => (
                          <div key={visu.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{visu.nome || "Usuário sem nome"}</p>
                              <p className="text-[11px] text-gray-500 truncate">{visu.email || "—"}</p>
                            </div>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                              {new Date(visu.criado_em).toLocaleString("pt-BR", {
                                day: "2-digit", month: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
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
      
      <ModalNovaSolicitacaoAdm 
        aberto={modalCriacaoAberto} 
        onOpenChange={setModalCriacaoAberto} 
        onSucesso={() => {
          setModalCriacaoAberto(false);
          carregarSolicitacoes();
        }}
      />

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!solicitacaoParaDeletar} onOpenChange={(open) => !open && setSolicitacaoParaDeletar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Excluir Solicitação
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-700">
            <p className="mb-2">
              Tem certeza que deseja excluir a solicitação de busca da empresa <strong>{solicitacaoParaDeletar?.razao_social}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              Esta ação não pode ser desfeita e o usuário será notificado por e-mail sobre o cancelamento.
            </p>
          </div>
          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setSolicitacaoParaDeletar(null)} disabled={deletando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluirSolicitacao} disabled={deletando} className="bg-red-600 hover:bg-red-700 text-white">
              {deletando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutAdm>
  );
}
