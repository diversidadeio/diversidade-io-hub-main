import { useEffect, useState, useCallback } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import {
  Activity, AlertCircle,
  LogIn,
  LogOut,
  Key,
  Eye,
  CheckCircle2,
  XCircle,
  UserPlus,
  Search,
  Shield,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  Filter,
  ArrowRight,
  Radio,
  Ban,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface LogEntry {
  id: string;
  email: string;
  tipo_evento: string;
  empresa_id: string | null;
  nome_empresa: string | null;
  executor_adm_email: string | null;
  executor_nome?: string;
  executor_empresa?: string;
  ip_address: string | null;
  user_agent: string | null;
  detalhes: string | null;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Configuração visual dos badges por tipo de evento
// ---------------------------------------------------------------------------
const BADGE_CONFIG: Record<
  string,
  { label: string; cor: string; icone: React.FC<any> }
> = {
  login_sucesso:           { label: "Login",              cor: "bg-green-100 text-green-800",        icone: LogIn },
  login_falha:             { label: "Falha de Login",     cor: "bg-red-100 text-red-800",            icone: XCircle },
  logout:                  { label: "Logout",             cor: "bg-gray-100 text-gray-700",          icone: LogOut },
  troca_senha:             { label: "Troca de Senha",     cor: "bg-blue-100 text-blue-800",          icone: Key },
  adm_ver_empresa:         { label: "ADM Â· Visualizou",  cor: "bg-purple-100 text-purple-800",      icone: Eye },
  adm_aprovar_empresa:     { label: "ADM Â· Aprovou",     cor: "bg-emerald-100 text-emerald-800",    icone: CheckCircle2 },
  adm_rejeitar_empresa:    { label: "ADM Â· Rejeitou",    cor: "bg-orange-100 text-orange-800",      icone: XCircle },
  adm_gerar_senha:         { label: "ADM Â· Gerou Senha", cor: "bg-amber-100 text-amber-800",        icone: Key },
  usuario_convidar:        { label: "Convite Enviado",   cor: "bg-sky-100 text-sky-800",            icone: UserPlus },
  usuario_ver_empresa:     { label: "Viu Empresa",       cor: "bg-violet-100 text-violet-800",      icone: Building2 },
  usuario_pesquisa_empresa:{ label: "Pesquisou",         cor: "bg-slate-100 text-slate-700",        icone: Search },
};

// ---------------------------------------------------------------------------
// Componente de badge
// ---------------------------------------------------------------------------
function BadgeEvento({ tipo, detalhes }: { tipo: string; detalhes?: string | null }) {
  const cfg = { ...(BADGE_CONFIG[tipo] || { label: tipo, cor: "bg-gray-100 text-gray-700", icone: Activity }) };
  
  if (tipo === "login_falha" && detalhes?.includes("e-mail não cadastrado")) {
    cfg.label = "E-mail Não Cadastrado";
    cfg.cor = "bg-orange-100 text-orange-800";
    cfg.icone = Ban;
  }
  
  const Icon = cfg.icone;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cor}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formatação de data/hora
// ---------------------------------------------------------------------------
function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Formatação de Detalhes (Tradutor de logs antigos ou crus do Supabase)
// ---------------------------------------------------------------------------
function formatarDetalhes(detalhes?: string | null) {
  if (!detalhes) return "";
  const d = detalhes.toLowerCase();
  
  if (d.includes("invalid login credentials")) {
    return "Senha incorreta";
  }
  
  return detalhes;
}

// ---------------------------------------------------------------------------
// Componente de tabela de logs
// ---------------------------------------------------------------------------
function TabelaLogs({
  logs,
  carregando,
  pagina,
  totalPaginas,
  onPaginaAnterior,
  onProximaPagina,
  itensPorPagina,
  setItensPorPagina,
}: {
  logs: LogEntry[];
  carregando: boolean;
  pagina: number;
  totalPaginas: number;
  onPaginaAnterior: () => void;
  onProximaPagina: () => void;
  itensPorPagina: number;
  setItensPorPagina: (valor: number) => void;
}) {
  if (carregando) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Carregando logs...
      </div>
    );
  }
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Nenhum evento encontrado com os filtros selecionados.
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Data / Hora</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Evento</th>
              <th className="px-4 py-3 font-medium max-w-[200px]">Detalhes</th>
              <th className="px-4 py-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {formatarDataHora(log.criado_em)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[180px]">
                  {log.email}
                </td>
                <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">
                  {log.nome_empresa || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <BadgeEvento tipo={log.tipo_evento} detalhes={log.detalhes} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px]">
                  <span className="truncate block" title={formatarDetalhes(log.detalhes)}>
                    {formatarDetalhes(log.detalhes) || <span className="text-gray-300">—</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#7030A0] border border-[#7030A0]/40 rounded-lg hover:bg-[#7030A0] hover:text-white hover:border-[#7030A0] transition-all duration-200 group">
                        Detalhes
                        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-white border border-gray-100 shadow-xl">
                      <DialogHeader>
                        <DialogTitle className="text-[#7030A0]">Detalhes do Evento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 py-2 max-h-[80vh] overflow-y-auto">
                        
                        {/* Seção 1: Quem Fez a Ação */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#7030A0] mb-3 border-b border-gray-100 pb-1">
                            1. Autor da Ação
                          </h4>
                          <div className="grid grid-cols-1 gap-3 text-sm bg-gray-50/50 p-3 rounded-md border border-gray-100">
                            <div>
                              <span className="font-semibold text-gray-600 block">Usuário (E-mail)</span>
                              <span className="text-gray-900">{log.email}</span>
                            </div>
                            {log.executor_nome && (
                              <div>
                                <span className="font-semibold text-gray-600 block">Nome do Responsável</span>
                                <span className="text-gray-900">{log.executor_nome}</span>
                              </div>
                            )}
                            {log.executor_empresa && (
                              <div>
                                <span className="font-semibold text-gray-600 block">Vínculo / Empresa</span>
                                <span className="text-gray-900">{log.executor_empresa}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Seção 2: O Que Foi Feito */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#7030A0] mb-3 border-b border-gray-100 pb-1">
                            2. Detalhes da Ação
                          </h4>
                          <div className="grid grid-cols-1 gap-3 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-semibold text-gray-600 block">Data / Hora</span>
                                <span className="text-gray-900">{formatarDataHora(log.criado_em)}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-600 block">Evento</span>
                                <div className="mt-1"><BadgeEvento tipo={log.tipo_evento} detalhes={log.detalhes} /></div>
                              </div>
                            </div>

                            {/* Mostra "Empresa Alvo" se existir nome_empresa (que geralmente indica quem sofreu a ação) */}
                            {log.nome_empresa && log.tipo_evento !== 'login_sucesso' && log.tipo_evento !== 'login_falha' && log.tipo_evento !== 'logout' && (
                              <div>
                                <span className="font-semibold text-gray-600 block">Alvo da Ação (Empresa)</span>
                                <span className="text-gray-900">{log.nome_empresa}</span>
                              </div>
                            )}

                            <div>
                              <span className="font-semibold text-gray-600 block text-sm mb-1">Descrição do Evento</span>
                              <div className="bg-white p-3 rounded-md text-sm text-gray-700 min-h-[60px] whitespace-pre-wrap border border-gray-200 shadow-sm">
                                {formatarDetalhes(log.detalhes) || "Nenhum detalhe adicional fornecido."}
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </DialogContent>
                  </Dialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Paginação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 whitespace-nowrap">Mostrar:</span>
          <Select value={itensPorPagina.toString()} onValueChange={(val) => setItensPorPagina(Number(val))}>
            <SelectTrigger className="h-8 w-[70px] bg-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500 ml-2">
            Página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong>
          </span>
        </div>
        {totalPaginas > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPaginaAnterior}
              disabled={pagina <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onProximaPagina}
              disabled={pagina >= totalPaginas}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hook para buscar logs com filtros e paginação
// ---------------------------------------------------------------------------
const POR_PAGINA = 30;

interface FiltrosLogs {
  tipoEvento?: string;
  emailBusca?: string;
  empresaId?: string;
  nomeEmpresa?: string;
  periodo?: string;
}

function useLogs(filtros: FiltrosLogs) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [carregando, setCarregando] = useState(true);

  const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina));

  const buscar = useCallback(async (paginaAtual: number) => {
    setCarregando(true);
    try {
      const response = await fetch("/api/ler-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoEvento: filtros.tipoEvento,
          emailBusca: filtros.emailBusca,
          nomeEmpresa: filtros.nomeEmpresa,
          empresaId: filtros.empresaId,
          periodo: filtros.periodo,
          page: paginaAtual,
          pageSize: itensPorPagina,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar logs");
      }

      const result = await response.json();
      setLogs(result.logs || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error(err);
      // Opcional: tratar erro na interface
    } finally {
      setCarregando(false);
    }
  }, [filtros.tipoEvento, filtros.emailBusca, filtros.empresaId, filtros.nomeEmpresa, filtros.periodo, itensPorPagina]);

  useEffect(() => {
    setPagina(1);
  }, [filtros.tipoEvento, filtros.emailBusca, filtros.empresaId, filtros.nomeEmpresa, filtros.periodo, itensPorPagina]);

  useEffect(() => {
    buscar(pagina);
  }, [buscar, pagina]);

  return {
    logs, total, pagina, totalPaginas, carregando, itensPorPagina,
    setPagina, setItensPorPagina,
    recarregar: () => buscar(pagina),
  };
}

// ---------------------------------------------------------------------------
// Hook para buscar logs de uma empresa específica via /api/ler-logs-empresa
// ---------------------------------------------------------------------------
interface FiltrosLogsEmpresa {
  nomeEmpresa?: string;
  empresaId?: string;
  modo: "sobre_empresa" | "usuarios_empresa";
}

function useLogsEmpresa(filtros: FiltrosLogsEmpresa) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [carregando, setCarregando] = useState(false);
  const [emailsVinculados, setEmailsVinculados] = useState<string[]>([]);

  const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina));

  const buscar = useCallback(async (paginaAtual: number) => {
    // Não busca se não tiver empresa informada
    if (!filtros.nomeEmpresa && !filtros.empresaId) {
      setLogs([]);
      setTotal(0);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const response = await fetch("/api/ler-logs-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeEmpresa: filtros.nomeEmpresa,
          empresaId: filtros.empresaId,
          modo: filtros.modo,
          page: paginaAtual,
          pageSize: itensPorPagina,
        }),
      });
      if (!response.ok) throw new Error("Erro ao carregar logs da empresa");
      const result = await response.json();
      setLogs(result.logs || []);
      setTotal(result.total || 0);
      setEmailsVinculados(result.emailsVinculados || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [filtros.nomeEmpresa, filtros.empresaId, filtros.modo, itensPorPagina]);

  useEffect(() => {
    setPagina(1);
  }, [filtros.nomeEmpresa, filtros.empresaId, filtros.modo, itensPorPagina]);

  useEffect(() => {
    buscar(pagina);
  }, [buscar, pagina]);

  return {
    logs, total, pagina, totalPaginas, carregando, itensPorPagina, emailsVinculados,
    setPagina, setItensPorPagina,
    recarregar: () => buscar(pagina),
  };
}

// ---------------------------------------------------------------------------
// Componente de Usuários Online
// ---------------------------------------------------------------------------
function AbaUsuariosOnline() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregarOnline = async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/usuarios-online");
      if (!res.ok) throw new Error("Erro ao buscar usuários online");
      const data = await res.json();
      
      const agora = new Date().getTime();
      
      const processados = (data.usuarios || []).map((u: any) => {
        const dataAcao = new Date(u.ultimaAtividade).getTime();
        const minAtras = Math.floor((agora - dataAcao) / 60000);
        const isOnline = minAtras <= 30 && u.ultimoEvento !== "logout" && u.ultimoEvento !== "login_falha";
        
        return {
          ...u,
          status: isOnline ? "online" : "offline",
          minAtras,
          dataOriginal: dataAcao
        };
      });

      // Ordenar: Online no topo, em seguida por mais recente
      processados.sort((a: any, b: any) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (a.status !== "online" && b.status === "online") return 1;
        return b.dataOriginal - a.dataOriginal;
      });

      setUsuarios(processados);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarOnline();
    const interval = setInterval(carregarOnline, 60000); // Atualiza a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  const onlineCount = usuarios.filter(u => u.status === "online").length;

  const usuariosFiltrados = usuarios.filter(u => 
    u.email.toLowerCase().includes(busca.toLowerCase()) || 
    (u.empresa && u.empresa.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="p-4 bg-gray-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            Status dos Usuários ({onlineCount} online)
          </h2>
          <p className="text-sm text-gray-500">Histórico de atividade de todos os usuários da plataforma.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nome, e-mail ou empresa..."
              className="pl-9 h-9 bg-white"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button onClick={carregarOnline} disabled={carregando} size="sm" variant="outline" className="flex items-center gap-2 shrink-0">
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {erro && (
        <div className="p-3 mb-4 rounded-md bg-red-50 text-red-600 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {erro}
        </div>
      )}

      {carregando && usuarios.length === 0 ? (
        <div className="flex justify-center items-center py-12 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white border border-dashed border-gray-200 rounded-lg">
          <Radio className="w-12 h-12 text-gray-300 mb-3" />
          <p>Nenhum usuário ativo.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Usuário / Empresa</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Visto por último</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.map((u, i) => {
                  const dataAcao = new Date(u.ultimaAtividade);
                  const minAtras = Math.floor((new Date().getTime() - dataAcao.getTime()) / 60000);
                  
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{u.email}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{u.empresa}</div>
                      </td>
                      <td className="px-6 py-4">
                        {u.status === "online" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {u.status === "online" ? (
                          "agora mesmo"
                        ) : (
                          <>
                            <div>{dataAcao.toLocaleDateString('pt-BR')}</div>
                            <div className="text-xs">{dataAcao.toLocaleTimeString('pt-BR')}</div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function LogsAdm() {
  const [abaAtiva, setAbaAtiva] = useState<"geral" | "admin" | "empresa" | "usuario" | "online">("geral");

  // Filtros da aba Geral
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("7d");
  const [filtroEmail, setFiltroEmail] = useState("");

  // Aba Admin
  const [filtroAdminEmail, setFiltroAdminEmail] = useState("");
  const [filtroAdminPeriodo, setFiltroAdminPeriodo] = useState("7d");

  // Aba Empresa
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState("");
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [buscaEmpresaAtiva, setBuscaEmpresaAtiva] = useState("");
  const [showDropdownEmpresa, setShowDropdownEmpresa] = useState(false);
  // Subtab da aba Empresa: "sobre_empresa" = ações ADM | "usuarios_empresa" = ações dos usuários
  const [subAbaEmpresa, setSubAbaEmpresa] = useState<"sobre_empresa" | "usuarios_empresa">("usuarios_empresa");

  // Aba Usuário
  const [emailUsuario, setEmailUsuario] = useState("");
  const [emailUsuarioBusca, setEmailUsuarioBusca] = useState("");

  // Métricas rápidas
  const [metricas, setMetricas] = useState({
    loginsHoje: 0,
    falhasHoje: 0,
    usuariosAtivos7d: 0,
    acoesAdm7d: 0,
  });

  // Carregar lista de empresas para o filtro (tenta a tabela, mas também usa nome_empresa dos logs)
  useEffect(() => {
    supabase
      .from("empresas")
      .select("id, nome_fantasia, razao_social, cnpj, email")
      .order("nome_fantasia")
      .then(({ data, error }) => {
        if (error) console.error("Erro ao buscar empresas:", error);
        else console.log("Empresas carregadas:", data?.length);
        setEmpresas(data || []);
      });
  }, []);

  // Carregar métricas
  useEffect(() => {
    async function carregarMetricas() {
      try {
        const res = await fetch("/api/ler-logs-metricas");
        if (res.ok) {
          const dados = await res.json();
          setMetricas({
            loginsHoje: dados.loginsHoje || 0,
            falhasHoje: dados.falhasHoje || 0,
            usuariosAtivos7d: dados.usuariosAtivos7d || 0,
            acoesAdm7d: dados.acoesAdm7d || 0,
          });
        }
      } catch (e) {
        console.error("Erro ao carregar métricas:", e);
      }
    }
    carregarMetricas();
  }, []);

  // Hooks de logs para cada aba
  const logsGeral = useLogs({
    tipoEvento: filtroTipo,
    emailBusca: filtroEmail,
    periodo: filtroPeriodo,
  });

  const logsAdmin = useLogs({
    tipoEvento: "adm_%",
    emailBusca: filtroAdminEmail,
    periodo: filtroAdminPeriodo,
  });

  // Ações de ADM sobre a empresa (o que os admins fizeram com ela)
  const logsEmpresaSobre = useLogsEmpresa({
    nomeEmpresa: buscaEmpresaAtiva || undefined,
    empresaId: empresaSelecionada || undefined,
    modo: "sobre_empresa",
  });

  // Ações dos usuários vinculados à empresa (logins, pesquisas, etc.)
  const logsEmpresaUsuarios = useLogsEmpresa({
    nomeEmpresa: buscaEmpresaAtiva || undefined,
    empresaId: empresaSelecionada || undefined,
    modo: "usuarios_empresa",
  });

  const logsUsuario = useLogs({
    emailBusca: emailUsuarioBusca || undefined,
    periodo: "todos",
  });


  const abas = [
    { id: "geral",   label: "Geral do Sistema",   icone: Activity },
    { id: "admin",   label: "Ações de Admin",      icone: Shield },
    { id: "empresa", label: "Por Empresa",         icone: Building2 },
    { id: "usuario", label: "Por Usuário",         icone: Users },
    { id: "online",  label: "Status Online",       icone: Radio },
  ] as const;

  const empresasFiltradas = empresas.filter((e) => {
    if (!buscaEmpresa) return true;
    const term = buscaEmpresa.toLowerCase();
    return (
      (e.nome_fantasia || "").toLowerCase().includes(term) ||
      (e.razao_social || "").toLowerCase().includes(term) ||
      (e.cnpj || "").toLowerCase().includes(term) ||
      (e.email || "").toLowerCase().includes(term)
    );
  });

  console.log("Render LogsAdm. buscaEmpresa:", buscaEmpresa, "showDropdown:", showDropdownEmpresa, "empresas total:", empresas.length, "filtradas:", empresasFiltradas.length);

  const aplicarFiltroCard = (tipo: string, periodo: string) => {
    setAbaAtiva("geral");
    setFiltroTipo(tipo);
    setFiltroPeriodo(periodo);
  };

  return (
    <LayoutAdm>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs de Auditoria</h1>
          <p className="text-gray-600 mt-1">
            Trilha completa de acessos e ações para conformidade LGPD.
          </p>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: "logins", label: "Logins hoje",       valor: metricas.loginsHoje,     cor: "text-green-600",  bg: "bg-green-50",  icone: LogIn, action: () => aplicarFiltroCard("login_sucesso", "hoje") },
            { id: "falhas", label: "Falhas hoje",       valor: metricas.falhasHoje,     cor: "text-red-600",    bg: "bg-red-50",    icone: XCircle, action: () => aplicarFiltroCard("login_falha", "hoje") },
            { id: "ativos", label: "Usuários ativos (7d)", valor: metricas.usuariosAtivos7d, cor: "text-blue-600", bg: "bg-blue-50", icone: Users, action: () => aplicarFiltroCard("login_sucesso", "7d") },
            { id: "adm",    label: "Ações de ADM (7d)", valor: metricas.acoesAdm7d,    cor: "text-purple-600", bg: "bg-purple-50", icone: Shield, action: () => aplicarFiltroCard("adm_%", "7d") },
          ].map(({ id, label, valor, cor, bg, icone: Icon, action }) => (
            <button
              key={id}
              onClick={action}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 text-left hover:border-[#7030A0]/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-[#7030A0]/20"
            >
              <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                <Icon className={`w-6 h-6 ${cor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 group-hover:text-[#7030A0] transition-colors">{valor}</p>
                <p className="text-xs text-gray-500 mt-0.5 group-hover:text-gray-700 transition-colors">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Abas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Barra de abas */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {abas.map(({ id, label, icone: Icon }) => (
              <button
                key={id}
                onClick={() => setAbaAtiva(id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  abaAtiva === id
                    ? "border-[#7030A0] text-[#7030A0] bg-purple-50"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── ABA GERAL ─────────────────────────────────────────────── */}
          {abaAtiva === "geral" && (
            <div>
              <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center bg-gray-50">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="h-9 w-48 bg-white">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os eventos</SelectItem>
                    {Object.entries(BADGE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="h-9 w-36 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="todos">Todos os tempos</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por e-mail..."
                    className="pl-9 h-9 bg-white"
                    value={filtroEmail}
                    onChange={(e) => setFiltroEmail(e.target.value)}
                  />
                </div>
                <span className="text-sm text-gray-500 ml-auto">
                  {logsGeral.total} registros
                </span>
                <Button variant="outline" size="sm" onClick={logsGeral.recarregar}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <TabelaLogs
                logs={logsGeral.logs}
                carregando={logsGeral.carregando}
                pagina={logsGeral.pagina}
                totalPaginas={logsGeral.totalPaginas}
                onPaginaAnterior={() => logsGeral.setPagina((p) => p - 1)}
                onProximaPagina={() => logsGeral.setPagina((p) => p + 1)}
                itensPorPagina={logsGeral.itensPorPagina}
                setItensPorPagina={logsGeral.setItensPorPagina}
              />
            </div>
          )}

          {/* ── ABA AÇÕES DE ADMIN ─────────────────────────────────────── */}
          {abaAtiva === "admin" && (
            <div>
              <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center bg-gray-50">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select value={filtroAdminPeriodo} onValueChange={setFiltroAdminPeriodo}>
                  <SelectTrigger className="h-9 w-36 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="todos">Todos os tempos</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Filtrar por e-mail do admin..."
                    className="pl-9 h-9 bg-white"
                    value={filtroAdminEmail}
                    onChange={(e) => setFiltroAdminEmail(e.target.value)}
                  />
                </div>
                <span className="text-sm text-gray-500 ml-auto">
                  {logsAdmin.total} registros
                </span>
                <Button variant="outline" size="sm" onClick={logsAdmin.recarregar}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <TabelaLogs
                logs={logsAdmin.logs}
                carregando={logsAdmin.carregando}
                pagina={logsAdmin.pagina}
                totalPaginas={logsAdmin.totalPaginas}
                onPaginaAnterior={() => logsAdmin.setPagina((p) => p - 1)}
                onProximaPagina={() => logsAdmin.setPagina((p) => p + 1)}
                itensPorPagina={logsAdmin.itensPorPagina}
                setItensPorPagina={logsAdmin.setItensPorPagina}
              />
            </div>
          )}

              {/* ── ABA POR EMPRESA ── */}
              {abaAtiva === "empresa" && (
                <div>
                  {/* Barra de busca da empresa */}
                  <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center bg-gray-50">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setBuscaEmpresaAtiva(buscaEmpresa);
                      }}
                      className="flex gap-2 flex-1 min-w-[280px] max-w-lg"
                    >
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Buscar por nome, razão social ou CNPJ..."
                          className="pl-9 h-9 bg-white"
                          value={buscaEmpresa}
                          onChange={(e) => {
                            setBuscaEmpresa(e.target.value);
                            if (empresaSelecionada) setEmpresaSelecionada("");
                          }}
                          onFocus={() => setShowDropdownEmpresa(true)}
                          onBlur={() => setTimeout(() => setShowDropdownEmpresa(false), 200)}
                        />
                        {showDropdownEmpresa && buscaEmpresa && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md z-50 max-h-60 overflow-y-auto">
                            {empresasFiltradas.length > 0 ? (
                              empresasFiltradas.map((emp) => (
                                <div
                                  key={emp.id}
                                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    // A busca da API do backend favorece razao_social, então preenchemos com ela.
                                    setBuscaEmpresa(emp.razao_social || emp.nome_fantasia || "");
                                    // Comentado para forçar o backend a continuar pesquisando pelo NOME flexível como na versão online antiga
                                    // setEmpresaSelecionada(emp.id);
                                    setShowDropdownEmpresa(false);
                                  }}
                                >
                                  <div className="text-sm font-medium text-gray-900">{emp.nome_fantasia || emp.razao_social}</div>
                                  {(emp.razao_social || emp.cnpj) && (
                                    <div className="text-xs text-gray-400 flex flex-wrap gap-x-2 mt-0.5">
                                      {emp.razao_social && <span>{emp.razao_social}</span>}
                                      {emp.razao_social && emp.cnpj && <span>•</span>}
                                      {emp.cnpj && <span>{emp.cnpj}</span>}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                {empresas.length === 0 
                                  ? "Nenhuma empresa cadastrada no sistema ou falha ao carregar." 
                                  : "Nenhuma empresa encontrada com este termo."}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <Button type="submit" size="sm" style={{ backgroundColor: "#7030A0" }} className="text-white">
                        Buscar
                      </Button>
                      {buscaEmpresaAtiva && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { 
                            setBuscaEmpresa(""); 
                            setBuscaEmpresaAtiva(""); 
                            setEmpresaSelecionada("");
                          }}
                        >
                          Limpar
                        </Button>
                      )}
                    </form>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        subAbaEmpresa === "usuarios_empresa"
                          ? logsEmpresaUsuarios.recarregar()
                          : logsEmpresaSobre.recarregar();
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Subtabs */}
                  {buscaEmpresaAtiva && (
                    <div className="flex border-b border-gray-200 bg-white px-4 pt-2 gap-1">
                      <button
                        onClick={() => setSubAbaEmpresa("usuarios_empresa")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                          subAbaEmpresa === "usuarios_empresa"
                            ? "border-[#7030A0] text-[#7030A0] bg-purple-50"
                            : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        Ações dos Usuários
                        {logsEmpresaUsuarios.total > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                            {logsEmpresaUsuarios.total}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setSubAbaEmpresa("sobre_empresa")}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                          subAbaEmpresa === "sobre_empresa"
                            ? "border-[#7030A0] text-[#7030A0] bg-purple-50"
                            : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        Ações de ADM sobre a Empresa
                        {logsEmpresaSobre.total > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                            {logsEmpresaSobre.total}
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Conteúdo da subtab */}
                  {!buscaEmpresaAtiva ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                      <Building2 className="w-10 h-10 text-gray-200" />
                      <p>Digite o nome de uma empresa e clique em Buscar.</p>
                    </div>
                  ) : subAbaEmpresa === "usuarios_empresa" ? (
                    <div>
                      {/* Info sobre e-mails vinculados encontrados */}
                      {logsEmpresaUsuarios.emailsVinculados.length > 0 && (
                        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            <strong>{logsEmpresaUsuarios.emailsVinculados.length}</strong> usuário(s) vinculado(s) encontrado(s):{" "}
                            {logsEmpresaUsuarios.emailsVinculados.join(", ")}
                          </span>
                        </div>
                      )}
                      <TabelaLogs
                        logs={logsEmpresaUsuarios.logs}
                        carregando={logsEmpresaUsuarios.carregando}
                        pagina={logsEmpresaUsuarios.pagina}
                        totalPaginas={logsEmpresaUsuarios.totalPaginas}
                        onPaginaAnterior={() => logsEmpresaUsuarios.setPagina((p) => p - 1)}
                        onProximaPagina={() => logsEmpresaUsuarios.setPagina((p) => p + 1)}
                        itensPorPagina={logsEmpresaUsuarios.itensPorPagina}
                        setItensPorPagina={logsEmpresaUsuarios.setItensPorPagina}
                      />
                    </div>
                  ) : (
                    <TabelaLogs
                      logs={logsEmpresaSobre.logs}
                      carregando={logsEmpresaSobre.carregando}
                      pagina={logsEmpresaSobre.pagina}
                      totalPaginas={logsEmpresaSobre.totalPaginas}
                      onPaginaAnterior={() => logsEmpresaSobre.setPagina((p) => p - 1)}
                      onProximaPagina={() => logsEmpresaSobre.setPagina((p) => p + 1)}
                      itensPorPagina={logsEmpresaSobre.itensPorPagina}
                      setItensPorPagina={logsEmpresaSobre.setItensPorPagina}
                    />
                  )}
                </div>
              )}


          {/* ── ABA POR USUÁRIO ────────────────────────────────────────── */}
          {abaAtiva === "usuario" && (
            <div>
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setEmailUsuarioBusca(emailUsuario);
                  }}
                  className="flex gap-3 items-center flex-wrap"
                >
                  <Users className="w-4 h-4 text-gray-400" />
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Digite o e-mail do usuário..."
                      className="pl-9 h-9 bg-white"
                      value={emailUsuario}
                      onChange={(e) => setEmailUsuario(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    style={{ backgroundColor: "#7030A0" }}
                    className="text-white"
                  >
                    Buscar
                  </Button>
                  {emailUsuarioBusca && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmailUsuario("");
                        setEmailUsuarioBusca("");
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                  {emailUsuarioBusca && (
                    <span className="text-sm text-gray-500 ml-auto">
                      {logsUsuario.total} eventos para "{emailUsuarioBusca}"
                    </span>
                  )}
                </form>
              </div>
              {!emailUsuarioBusca ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                  <Users className="w-10 h-10 text-gray-200" />
                  <p>Digite um e-mail e clique em Buscar para ver o histórico do usuário.</p>
                </div>
              ) : (
                <TabelaLogs
                  logs={logsUsuario.logs}
                  carregando={logsUsuario.carregando}
                  pagina={logsUsuario.pagina}
                  totalPaginas={logsUsuario.totalPaginas}
                  onPaginaAnterior={() => logsUsuario.setPagina((p) => p - 1)}
                  onProximaPagina={() => logsUsuario.setPagina((p) => p + 1)}
                  itensPorPagina={logsUsuario.itensPorPagina}
                  setItensPorPagina={logsUsuario.setItensPorPagina}
                />
              )}
            </div>
          )}

          {/* ── ABA USUÁRIOS ONLINE ──────────────────────────────────────── */}
          {abaAtiva === "online" && (
            <AbaUsuariosOnline />
          )}
        </div>
      </div>
    </LayoutAdm>
  );
}
