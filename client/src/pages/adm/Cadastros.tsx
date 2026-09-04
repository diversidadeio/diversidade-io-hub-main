import { useEffect, useState, useMemo, useRef } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import {
  Search,
  Loader2,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  History,
  RotateCcw,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ShieldQuestion,
  RefreshCw,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatusAprovacao = "todos" | "pendente" | "aprovado" | "suspenso";
type OptinFiltro = "todos" | "com_optin" | "sem_optin";
type CompletudeFiltro = "todos" | "completo" | "incompleto";
type OrdenacaoFiltro =
  | "recentes"
  | "antigos"
  | "nome_az"
  | "nome_za";
type SituacaoCNPJFiltro = "todos" | "ATIVA" | "INAPTA" | "BAIXADA" | "SUSPENSA" | "nao_verificado" | "irregular";

/** Situação cadastral na Receita Federal (retornada pela BrasilAPI e salva no banco) */
type SituacaoCNPJ = "ATIVA" | "INAPTA" | "BAIXADA" | "SUSPENSA" | "NULA" | "NAO_ENCONTRADO" | "ERRO_CONSULTA" | "CNPJ_INVALIDO" | "RATE_LIMIT" | null;

interface FiltrosState {
  status: StatusAprovacao;
  optin: OptinFiltro;
  completude: CompletudeFiltro;
  portes: string[];
  tiposAcesso: string[];
  semLogo: boolean;
  semDocumentos: boolean;
  semSocios: boolean;
  semCeps: boolean;
  dataInicio: string;
  dataFim: string;
  ordenacao: OrdenacaoFiltro;
  situacaoCnpj: SituacaoCNPJFiltro;
}

const FILTROS_PADRAO: FiltrosState = {
  status: "todos",
  optin: "todos",
  completude: "todos",
  portes: [],
  tiposAcesso: [],
  semLogo: false,
  semDocumentos: false,
  semSocios: false,
  semCeps: false,
  dataInicio: "",
  dataFim: "",
  ordenacao: "recentes",
  situacaoCnpj: "todos",
};

const PORTES_DISPONIVEIS = ["MEI", "ME", "MICRO", "EPP", "Média Empresa", "Grande Empresa"];
const TIPOS_ACESSO_DISPONIVEIS = ["EMPRESA OU INICIATIVA INCENTIVADORA", "FORNECEDOR INCLUSIVO", "EMPREENDIMENTO DIVERSO"];

const CAMPOS_OBRIGATORIOS = [
  "razao_social",
  "cnpj",
  "nome_responsavel",
  "telefone_principal",
  "area_empresa",
  "sobre_empresa",
];

// Campos que devem estar preenchidos em cada sócio
const CAMPOS_SOCIO_OBRIGATORIOS = [
  "nome",
  "cpf",
  "email",
  "cep",
  "data_nascimento",
  "nacionalidade",
  "raca",
  "participacao_percentual",
  "participacao_valor",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retorna true se todos os 10 campos obrigatórios do sócio estão preenchidos */
function socioCompleto(socio: any): boolean {
  return CAMPOS_SOCIO_OBRIGATORIOS.every(
    (campo) => socio[campo] != null && String(socio[campo]).trim() !== ""
  );
}

/**
 * Calcula a completude da empresa (0–100%).
 * A parte de sócios só conta como 100% se:
 *   - a empresa NÃO é do tipo "EMPRESA OU INICIATIVA INCENTIVADORA", E
 *   - existe ao menos 1 sócio cadastrado, E
 *   - todos os sócios têm os campos obrigatórios preenchidos.
 * Empresas incentivadoras não precisam de quadro societário para atingir 100%.
 */
function calcularCompletude(emp: any, listaSocios: any[]): number {
  const ehIncentivadora = emp.acesso_tipo === "EMPRESA OU INICIATIVA INCENTIVADORA";
  const total = CAMPOS_OBRIGATORIOS.length + (ehIncentivadora ? 0 : 1); // sócios não contam para incentivadoras
  let preenchidos = 0;
  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (emp[campo] && String(emp[campo]).trim() !== "") preenchidos++;
  }
  // Sócios: só verifica se não for incentivadora
  if (!ehIncentivadora) {
    if (listaSocios.length > 0 && listaSocios.every(socioCompleto)) preenchidos++;
  }
  return Math.round((preenchidos / total) * 100);
}

function BarraCompletude({ porcentagem }: { porcentagem: number }) {
  const cor =
    porcentagem === 100
      ? "bg-green-500"
      : porcentagem >= 60
      ? "bg-amber-400"
      : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cor}`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{porcentagem}%</span>
    </div>
  );
}

// ─── Badge de Situação CNPJ ───────────────────────────────────────────────────

const CONFIG_SITUACAO: Record<string, { label: string; cor: string; icone: React.ReactNode }> = {
  ATIVA:         { label: "Ativa",          cor: "bg-green-100 text-green-700 border-green-200",   icone: <ShieldCheck className="w-3 h-3" /> },
  INAPTA:        { label: "Inapta",         cor: "bg-orange-100 text-orange-700 border-orange-200", icone: <ShieldAlert className="w-3 h-3" /> },
  BAIXADA:       { label: "Baixada",        cor: "bg-red-100 text-red-700 border-red-200",          icone: <ShieldOff className="w-3 h-3" /> },
  SUSPENSA:      { label: "Suspensa",       cor: "bg-yellow-100 text-yellow-700 border-yellow-200", icone: <ShieldAlert className="w-3 h-3" /> },
  NULA:          { label: "Nula",           cor: "bg-gray-100 text-gray-500 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
  NAO_ENCONTRADO:{ label: "Não encontrado", cor: "bg-gray-100 text-gray-500 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
  ERRO_CONSULTA: { label: "Erro",           cor: "bg-gray-100 text-gray-500 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
  CNPJ_INVALIDO: { label: "CNPJ inválido",  cor: "bg-gray-100 text-gray-400 border-gray-200",       icone: <ShieldQuestion className="w-3 h-3" /> },
};

function BadgeSituacaoCNPJ({
  situacao,
  verificadoEm,
}: {
  situacao: SituacaoCNPJ;
  verificadoEm: string | null;
}) {
  if (!situacao) {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className="inline-flex justify-center items-center gap-1.5 w-[115px] py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 text-xs whitespace-nowrap">
          <ShieldQuestion className="w-3 h-3" />
          Não verificado
        </span>
      </div>
    );
  }
  const config = CONFIG_SITUACAO[situacao] || {
    label: situacao,
    cor: "bg-gray-100 text-gray-500 border-gray-200",
    icone: <ShieldQuestion className="w-3 h-3" />,
  };
  const dataFormatada = verificadoEm
    ? new Date(verificadoEm).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span
        className={`inline-flex justify-center items-center gap-1.5 w-[115px] py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${config.cor}`}
        title={dataFormatada ? `Verificado em ${dataFormatada}` : undefined}
      >
        {config.icone}
        {config.label}
      </span>
      {dataFormatada && (
        <span className="text-[10px] text-gray-400">{dataFormatada}</span>
      )}
    </div>
  );
}

// ─── Modal de Verificação em Massa de CNPJs ───────────────────────────────────

type EstadoVerificacao = "selecao" | "verificando" | "concluido" | "erro";

interface ProgressoItem {
  empresa_id: string;
  razao_social: string;
  cnpj: string;
  situacao: string;
  verificado_em: string;
  atual: number;
  total: number;
}

interface ResumoVerificacao {
  total: number;
  resumo: Record<string, number>;
}

function ModalVerificarCNPJs({
  aberto,
  onFechar,
  empresas,
  situacoes,
  onAtualizarSituacao,
}: {
  aberto: boolean;
  onFechar: () => void;
  empresas: any[];
  situacoes: Record<string, { situacao: SituacaoCNPJ; verificado_em: string | null }>;
  onAtualizarSituacao: (empresaId: string, situacao: string, verificadoEm: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoVerificacao>("selecao");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [progresso, setProgresso] = useState<ProgressoItem | null>(null);
  const [resumo, setResumo] = useState<ResumoVerificacao | null>(null);
  const [erroMsg, setErroMsg] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Reseta o estado ao abrir o modal
  useEffect(() => {
    if (aberto) {
      setEstado("selecao");
      setBusca("");
      setFiltroStatus("todos");
      setSelecionadas(new Set(empresas.map((e) => e.id)));
      setProgresso(null);
      setResumo(null);
      setErroMsg("");
    }
  }, [aberto, empresas]);

  // Limpa o SSE ao desmontar
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  if (!aberto) return null;

  const empresasFiltradas = empresas.filter((e) => {
    const termo = busca.toLowerCase();
    const passaBusca =
      !termo ||
      (e.razao_social && e.razao_social.toLowerCase().includes(termo)) ||
      (e.cnpj && e.cnpj.includes(termo));
    
    if (!passaBusca) return false;

    const sit = situacoes[e.id];
    
    if (filtroStatus === "nao_verificados") {
      if (sit && sit.situacao) return false;
    } else if (filtroStatus !== "todos") {
      // Filtrar por status específico (ATIVA, INAPTA, BAIXADA, etc)
      if (!sit || sit.situacao !== filtroStatus) return false;
    }

    return true;
  });

  const totalSelecionadas = selecionadas.size;
  const tempoEstimadoSeg = Math.ceil(totalSelecionadas * 0.5);
  const tempoFormatado =
    tempoEstimadoSeg < 60
      ? `~${tempoEstimadoSeg} seg`
      : `~${Math.floor(tempoEstimadoSeg / 60)} min ${tempoEstimadoSeg % 60} seg`;

  function toggleEmpresa(id: string) {
    setSelecionadas((prev) => {
      const nova = new Set(prev);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  function selecionarTodas() {
    setSelecionadas(new Set(empresasFiltradas.map((e) => e.id)));
  }

  function limparSelecao() {
    setSelecionadas(new Set());
  }

  function cancelarVerificacao() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setEstado("selecao");
  }

  function iniciarVerificacao() {
    if (selecionadas.size === 0) return;

    setEstado("verificando");
    setProgresso(null);
    setResumo(null);

    const ids = Array.from(selecionadas).join(",");
    const es = new EventSource(`/api/verificar-cnpjs-lote?ids=${ids}`);
    eventSourceRef.current = es;

    es.addEventListener("progresso", (e) => {
      const dado: ProgressoItem = JSON.parse(e.data);
      setProgresso(dado);
      onAtualizarSituacao(dado.empresa_id, dado.situacao, dado.verificado_em);
    });

    es.addEventListener("concluido", (e) => {
      const dado: ResumoVerificacao = JSON.parse(e.data);
      setResumo(dado);
      setEstado("concluido");
      es.close();
    });

    es.addEventListener("erro", (e) => {
      const dado = JSON.parse(e.data);
      setErroMsg(dado.mensagem || "Erro durante a verificação.");
      setEstado("erro");
      es.close();
    });

    es.onerror = () => {
      setErroMsg("Conexão perdida com o servidor.");
      setEstado("erro");
      es.close();
    };
  }

  // ── Tela de Seleção ─────────────────────────────────────────────────────────
  if (estado === "selecao") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh]">
          {/* Cabeçalho */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#7030A0]" />
                Verificar Situação dos CNPJs
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Consulta a Receita Federal via BrasilAPI (~450ms por empresa).
              </p>
            </div>
            <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controles de seleção */}
          <div className="px-6 py-3 border-b border-gray-100 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={selecionarTodas}
                className="text-xs text-[#7030A0] font-medium hover:underline"
              >
                ✓ Selecionar todas
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={limparSelecao}
                className="text-xs text-gray-500 hover:underline"
              >
                ✕ Limpar seleção
              </button>
              <span className="ml-auto text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{totalSelecionadas}</span> selecionada{totalSelecionadas !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar empresa ou CNPJ..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <select
                value={filtroStatus}
                onChange={(e: any) => {
                  setFiltroStatus(e.target.value);
                  setSelecionadas(new Set());
                }}
                className="w-48 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 px-2 bg-white"
              >
                <option value="todos">Todos</option>
                <option value="nao_verificados">Nunca verificados</option>
                <option value="ATIVA">Ativa</option>
                <option value="INAPTA">Inapta (Inativa)</option>
                <option value="BAIXADA">Baixada</option>
                <option value="SUSPENSA">Suspensa</option>
                <option value="NULA">Nula</option>
              </select>
            </div>
            {/* Auto-select button when filtering? We can keep it manual */}
          </div>

          {/* Lista de empresas */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {empresasFiltradas.map((emp) => {
              const sit = situacoes[emp.id];
              return (
              <label
                key={emp.id}
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.has(emp.id)}
                  onChange={() => toggleEmpresa(emp.id)}
                  className="w-4 h-4 accent-[#7030A0] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {emp.razao_social || "Sem razão social"}
                  </div>
                  <div className="text-xs text-gray-400">{emp.cnpj || "CNPJ não informado"}</div>
                </div>
                {sit && sit.situacao ? (
                  <div className="flex-shrink-0 scale-[0.8] origin-right">
                    <BadgeSituacaoCNPJ situacao={sit.situacao} verificadoEm={sit.verificado_em} />
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">Nunca verificado</span>
                )}
              </label>
            )})}
            {empresasFiltradas.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">
                Nenhuma empresa encontrada.
              </p>
            )}
          </div>

          {/* Rodapé */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">
                ⏱ Tempo estimado: <span className="font-medium text-gray-600">{tempoFormatado}</span>
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onFechar}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={iniciarVerificacao}
                disabled={totalSelecionadas === 0}
                className="flex-1 py-2 rounded-lg bg-[#7030A0] hover:bg-purple-800 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Iniciar Verificação
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Tela de Progresso ───────────────────────────────────────────────────────
  if (estado === "verificando") {
    const atual = progresso?.atual ?? 0;
    const total = progresso?.total ?? totalSelecionadas;
    const pct = total > 0 ? Math.round((atual / total) * 100) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-[#7030A0] animate-spin" />
            Verificando CNPJs...
          </h2>

          {/* Barra de progresso */}
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7030A0] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{atual} de {total} empresas</span>
              <span>{pct}%</span>
            </div>
          </div>

          {/* Empresa atual */}
          {progresso && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Verificando agora</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{progresso.razao_social}</p>
              <p className="text-xs text-gray-500">{progresso.cnpj}</p>
              <div className="mt-2">
                <BadgeSituacaoCNPJ situacao={progresso.situacao as SituacaoCNPJ} verificadoEm={null} />
              </div>
            </div>
          )}

          <button
            onClick={cancelarVerificacao}
            className="w-full py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar processo
          </button>
        </div>
      </div>
    );
  }

  // ── Tela de Conclusão ───────────────────────────────────────────────────────
  if (estado === "concluido" && resumo) {
    const labelSituacao: Record<string, string> = {
      ATIVA: "🟢 Ativas",
      INAPTA: "🟠 Inativas",
      BAIXADA: "🔴 Baixadas",
      SUSPENSA: "🟡 Suspensas",
      NULA: "⚪ Nulas",
      NAO_ENCONTRADO: "❓ Não encontradas",
      ERRO_CONSULTA: "⚠️ Erros",
      CNPJ_INVALIDO: "⛔ CNPJ inválido",
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verificação Concluída!</h2>
            <p className="text-sm text-gray-500 mt-1">
              {resumo.total} empresa{resumo.total !== 1 ? "s" : ""} verificada{resumo.total !== 1 ? "s" : ""}.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            {Object.entries(resumo.resumo).map(([sit, qtd]) => (
              <div key={sit} className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{labelSituacao[sit] || sit}</span>
                <span className="font-bold text-gray-900">{qtd}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onFechar}
            className="w-full py-2.5 rounded-lg bg-[#7030A0] hover:bg-purple-800 text-white text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // ── Tela de Erro ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">Erro na verificação</h2>
        <p className="text-sm text-gray-500">{erroMsg}</p>
        <button
          onClick={() => setEstado("selecao")}
          className="w-full py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CadastrosAdm() {
  const { usuario } = useAuth();
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [socios, setSocios] = useState<Record<string, any[]>>({});
  const [ceps, setCeps] = useState<Record<string, any[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  // ── Estados de situação CNPJ ──────────────────────────────────────────────
  const [situacoesCnpj, setSituacoesCnpj] = useState<Record<string, { situacao: SituacaoCNPJ; verificado_em: string | null }>>({});
  const [modalVerificarAberto, setModalVerificarAberto] = useState(false);

  function atualizarSituacaoCnpj(empresaId: string, situacao: string, verificadoEm: string) {
    setSituacoesCnpj((prev) => ({
      ...prev,
      [empresaId]: { situacao: situacao as SituacaoCNPJ, verificado_em: verificadoEm },
    }));
  }
  // ── Fim estados CNPJ ──────────────────────────────────────────────────────

  // ── Estados do modo Busca com IA ─────────────────────────────────────────
  const [modoIA, setModoIA] = useState(false);
  const [buscaIA, setBuscaIA] = useState("");
  const [resultadosIA, setResultadosIA] = useState<any[]>([]);
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [erroIA, setErroIA] = useState("");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoIA, setHistoricoIA] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  // ── Fim do modo IA ────────────────────────────────────────────────────────

  // Filtros
  const [modalAberto, setModalAberto] = useState(false);
  const [filtrosTemp, setFiltrosTemp] = useState<FiltrosState>(FILTROS_PADRAO);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosState>(FILTROS_PADRAO);

  // Paginação
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);

  // ── Carregar dados ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function carregarCadastros() {
      try {
        // Query principal — campos que sempre existiram (sem situacao_cnpj)
        const { data, error } = await supabase
          .from("empresas")
          .select("*")
          .neq("tipo_usuario", "adm")
          .order("created_at", { ascending: false });

        if (error) throw error;
        const lista = data || [];
        setCadastros(lista);

        // Query separada para situação CNPJ (campos novos — só existe após a migration)
        // Se os campos ainda não existirem no banco, falha silenciosamente sem quebrar o carregamento
        try {
          const { data: cnpjData } = await supabase
            .from("empresas")
            .select("id, situacao_cnpj, situacao_cnpj_verificado_em")
            .neq("tipo_usuario", "adm");

          if (cnpjData) {
            const situacoesMap: Record<string, { situacao: SituacaoCNPJ; verificado_em: string | null }> = {};
            cnpjData.forEach((emp: any) => {
              if (emp.situacao_cnpj || emp.situacao_cnpj_verificado_em) {
                situacoesMap[emp.id] = {
                  situacao: emp.situacao_cnpj as SituacaoCNPJ,
                  verificado_em: emp.situacao_cnpj_verificado_em,
                };
              }
            });
            setSituacoesCnpj(situacoesMap);
          }
        } catch {
          // Colunas de situação CNPJ ainda não existem — ignora silenciosamente
          console.info("Campos situacao_cnpj ainda não disponíveis no banco.");
        }

        // Buscar sócios com todos os campos necessários para cálculo de completude
        const { data: sociosData } = await supabase
          .from("socios")
          .select("*");
        const sociosMap: Record<string, any[]> = {};
        (sociosData || []).forEach((s: any) => {
          if (!sociosMap[s.empresa_id]) sociosMap[s.empresa_id] = [];
          sociosMap[s.empresa_id].push(s);
        });
        setSocios(sociosMap);

        // Buscar quais empresas têm CEPs de impacto
        const { data: cepsData } = await supabase
          .from("ceps_impactados")
          .select("*");
        const cepsMap: Record<string, any[]> = {};
        (cepsData || []).forEach((c: any) => {
          if (!cepsMap[c.empresa_id]) cepsMap[c.empresa_id] = [];
          cepsMap[c.empresa_id].push(c);
        });
        setCeps(cepsMap);
      } catch (err) {
        console.error("Erro ao carregar cadastros:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarCadastros();
  }, []);

  // ── Funções de Busca com IA ───────────────────────────────────────────────
  const SESSAO_KEY = "admin_pesquisas_ia_estado";
  
  // Restaura estado do sessionStorage ao montar (ex: ao voltar da página de detalhes)
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(SESSAO_KEY);
      if (salvo) {
        const { buscaIA: q, resultadosIA: r } = JSON.parse(salvo);
        setModoIA(true);
        setBuscaIA(q || "");
        setResultadosIA(r || []);
      }
    } catch {
      sessionStorage.removeItem(SESSAO_KEY);
    }
  }, []); // executa apenas na montagem

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    try {
      const email = usuario?.email || "";
      if (!email) {
        setHistoricoIA([]);
        return;
      }
      const resp = await fetch(`/api/historico-buscas-ia?isAdmin=true&adminEmail=${encodeURIComponent(email)}`);
      const dados = await resp.json();
      setHistoricoIA(dados.historico || []);
    } catch {
      setHistoricoIA([]);
    } finally {
      setCarregandoHistorico(false);
    }
  }

  async function executarBuscaIA() {
    if (!buscaIA.trim() || buscaIA.trim().length < 5) {
      setErroIA("Descreva com mais detalhes o que você precisa (mínimo 5 caracteres).");
      return;
    }
    setErroIA("");
    setCarregandoIA(true);
    setResultadosIA([]);
    try {
      const email = usuario?.email || "";
      const resposta = await fetch("/api/busca-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: buscaIA.trim(),
          isAdmin: true,
          adminEmail: email,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroIA(dados.erro || "Erro ao realizar a busca. Tente novamente.");
        return;
      }
      const resultados = dados.resultados || [];
      setResultadosIA(resultados);
      // Persiste no sessionStorage para restaurar ao voltar
      sessionStorage.setItem(SESSAO_KEY, JSON.stringify({ buscaIA: buscaIA.trim(), resultadosIA: resultados }));
      if (resultados.length === 0) {
        setErroIA(dados.mensagem || "Nenhuma empresa encontrada para essa descrição. Tente usar outras palavras.");
      }
    } catch {
      setErroIA("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setCarregandoIA(false);
    }
  }

  function restaurarDoBancoDoDados(item: any) {
    setBuscaIA(item.descricao || "");
    setResultadosIA(item.resultados || []);
    setErroIA("");
    setHistoricoAberto(false);
    // Persiste no sessionStorage para sobreviver à navegação
    sessionStorage.setItem(SESSAO_KEY, JSON.stringify({ buscaIA: item.descricao, resultadosIA: item.resultados }));
  }

  function abrirModoIA() {
    // Só limpa se não houver estado salvo no sessionStorage
    const salvo = sessionStorage.getItem(SESSAO_KEY);
    if (!salvo) {
      setBuscaIA("");
      setResultadosIA([]);
      setErroIA("");
    }
    setModoIA(true);
  }

  function fecharModoIA() {
    sessionStorage.removeItem(SESSAO_KEY);
    setModoIA(false);
    setBuscaIA("");
    setResultadosIA([]);
    setErroIA("");
  }
  // ── Fim Busca com IA ──────────────────────────────────────────────────────

  // ── Filtros e paginação ─────────────────────────────────────────────────────

  const cadastrosFiltrados = useMemo(() => {
    let lista = cadastros.filter((emp) => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !termo ||
        (emp.razao_social && emp.razao_social.toLowerCase().includes(termo)) ||
        (emp.cnpj && emp.cnpj.includes(termo)) ||
        (emp.email && emp.email.toLowerCase().includes(termo)) ||
        (emp.sobre_empresa && emp.sobre_empresa.toLowerCase().includes(termo)) ||
        (emp.atividade_empresarial && emp.atividade_empresarial.toLowerCase().includes(termo));

      const matchStatus =
        filtrosAtivos.status === "todos" ||
        emp.status_aprovacao === filtrosAtivos.status;

      const matchOptin =
        filtrosAtivos.optin === "todos" ||
        (filtrosAtivos.optin === "com_optin" &&
          emp.autoriza_compartilhamento === "Sim") ||
        (filtrosAtivos.optin === "sem_optin" &&
          emp.autoriza_compartilhamento !== "Sim");

      const listaSocios = socios[emp.id] || [];
      const completude = calcularCompletude(emp, listaSocios);
      const matchCompletude =
        filtrosAtivos.completude === "todos" ||
        (filtrosAtivos.completude === "completo" && completude === 100) ||
        (filtrosAtivos.completude === "incompleto" && completude < 100);

      const matchPorte =
        filtrosAtivos.portes.length === 0 ||
        (emp.porte_empresa &&
          filtrosAtivos.portes.includes(emp.porte_empresa));

      const matchTipoAcesso =
        filtrosAtivos.tiposAcesso.length === 0 ||
        (emp.acesso_tipo &&
          filtrosAtivos.tiposAcesso.some((tipo) =>
            emp.acesso_tipo.includes(tipo)
          ));

      const matchSemLogo = !filtrosAtivos.semLogo || !emp.logo_empresa_url;

      const matchSemDoc =
        !filtrosAtivos.semDocumentos ||
                (!emp.cartao_cnpj_url && !emp.ficha_junta_url);

      const matchSemSocios =
        !filtrosAtivos.semSocios || !(socios[emp.id]?.length > 0);

      const matchSemCeps =
        !filtrosAtivos.semCeps || !(ceps[emp.id] && ceps[emp.id].length > 0);

      const matchDataInicio =
        !filtrosAtivos.dataInicio ||
        new Date(emp.created_at) >= new Date(filtrosAtivos.dataInicio);

      const matchDataFim =
        !filtrosAtivos.dataFim ||
        new Date(emp.created_at) <=
          new Date(filtrosAtivos.dataFim + "T23:59:59");

      const matchSituacaoCnpj = (() => {
        if (filtrosAtivos.situacaoCnpj === "todos") return true;
        const sit = situacoesCnpj[emp.id]?.situacao;
        if (filtrosAtivos.situacaoCnpj === "nao_verificado") return !sit;
        if (filtrosAtivos.situacaoCnpj === "irregular") return sit && sit !== "ATIVA";
        return sit === filtrosAtivos.situacaoCnpj;
      })();

      return (
        matchBusca &&
        matchStatus &&
        matchOptin &&
        matchCompletude &&
        matchPorte &&
        matchTipoAcesso &&
        matchSemLogo &&
        matchSemDoc &&
        matchSemSocios &&
        matchSemCeps &&
        matchDataInicio &&
        matchDataFim &&
        matchSituacaoCnpj
      );
    });

    // Ordenação
    lista = [...lista].sort((a, b) => {
      if (filtrosAtivos.ordenacao === "antigos") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (filtrosAtivos.ordenacao === "nome_az") {
        return (a.razao_social || "").localeCompare(b.razao_social || "");
      }
      if (filtrosAtivos.ordenacao === "nome_za") {
        return (b.razao_social || "").localeCompare(a.razao_social || "");
      }
      // recentes (padrão)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return lista;
  }, [cadastros, socios, ceps, situacoesCnpj, busca, filtrosAtivos]);

  const exportarParaExcel = () => {
    const dadosFormatados = cadastrosFiltrados.map((emp) => {
      const sit = situacoesCnpj[emp.id];
      const listaSocios = socios[emp.id] || [];
      const listaCeps = ceps[emp.id] || [];
      const completude = calcularCompletude(emp, listaSocios);
      
      const baseObj: any = {
        "Razão Social": emp.razao_social || "",
        "Nome Fantasia": emp.nome_fantasia || "",
        "CNPJ": emp.cnpj || "",
        "Tipo de Acesso": emp.acesso_tipo || "",
        "Área de Atuação": emp.area_empresa || "",
        "Área Geográfica": emp.area_geografica || emp.cidade || "",
        "Sobre a Empresa": emp.sobre_empresa || "",
        "Responsável": emp.nome_responsavel || "",
        "E-mail": emp.email || "",
        "Telefone Principal": emp.telefone_principal || "",
        "Outro Telefone": emp.telefone || "",
        "Informações Financeiras": emp.informacoes_financeiras || "",
        "Faturamento": emp.faturamento || "",
        "Porte da Empresa": emp.porte_empresa || "",
        "Atividade Empresarial": emp.atividade_empresarial || "",
        "Emite Nota Fiscal": emp.emite_nota_fiscal === true ? "Sim" : (emp.emite_nota_fiscal === false ? "Não" : ""),
        "Possui Conta PJ": emp.possui_conta_pj === true ? "Sim" : (emp.possui_conta_pj === false ? "Não" : ""),
        "Forma de Pagamento": emp.forma_pagamento || "",
        "Forma de Recebimento": emp.forma_recebimento || "",
        "Situação CNPJ": sit?.situacao || "Não verificado",
        "Data Situação": sit?.verificado_em ? new Date(sit.verificado_em).toLocaleDateString("pt-BR") : "",
        "Completude (%)": completude,
        "Status de Aprovação": emp.status_aprovacao === "aprovado" ? "Aprovado" : emp.status_aprovacao === "suspenso" ? "Suspenso" : emp.status_aprovacao === "rejeitado" ? "Rejeitado" : "Pendente",
        "Data de Cadastro": emp.created_at ? new Date(emp.created_at).toLocaleDateString("pt-BR") : "",
      };

      // Adicionando Quadro Societário
      listaSocios.forEach((socio, index) => {
        const prefix = `Sócio ${index + 1} - `;
        baseObj[`${prefix}Nome`] = socio.nome || "";
        baseObj[`${prefix}CPF`] = socio.cpf || "";
        baseObj[`${prefix}E-mail`] = socio.email || "";
        baseObj[`${prefix}Data Nascimento`] = socio.data_nascimento ? new Date(socio.data_nascimento).toLocaleDateString("pt-BR") : "";
        baseObj[`${prefix}Nacionalidade`] = socio.nacionalidade || "";
        baseObj[`${prefix}Raça`] = socio.raca || "";
        baseObj[`${prefix}Gênero`] = socio.genero || "";
        baseObj[`${prefix}PCD`] = socio.pcd === true ? "Sim" : (socio.pcd === false ? "Não" : "");
        baseObj[`${prefix}Deficiência`] = socio.deficiencia || "";
        baseObj[`${prefix}Comunidade LGBTQIA+`] = socio.comunidade_lgbtqia === true ? "Sim" : (socio.comunidade_lgbtqia === false ? "Não" : "");
        baseObj[`${prefix}Localização (CEP)`] = socio.cep || "";
        baseObj[`${prefix}Participação (%)`] = socio.participacao_percentual || "";
        baseObj[`${prefix}Participação (Valor)`] = socio.participacao_valor || "";
      });

      // Adicionando Localizações (Gestores e Colaboradores) do array de CEPs
      // Filtramos para não repetir os sócios, ou podemos colocar todos organizados por tipo
      const cepsGestores = listaCeps.filter(c => c.tipo_pessoa === 'gestor');
      const cepsColabs = listaCeps.filter(c => c.tipo_pessoa === 'colaborador');

      cepsGestores.forEach((cepInfo, index) => {
        const prefix = `Gestor ${index + 1} - `;
        baseObj[`${prefix}CEP`] = cepInfo.cep || cepInfo.codigo_postal || "";
        baseObj[`${prefix}Endereço`] = cepInfo.endereco || "";
        baseObj[`${prefix}País`] = cepInfo.pais || "BR";
      });

      cepsColabs.forEach((cepInfo, index) => {
        const prefix = `Colaborador ${index + 1} - `;
        baseObj[`${prefix}CEP`] = cepInfo.cep || cepInfo.codigo_postal || "";
        baseObj[`${prefix}Endereço`] = cepInfo.endereco || "";
        baseObj[`${prefix}País`] = cepInfo.pais || "BR";
      });

      return baseObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Empresas");
    
    XLSX.writeFile(workbook, "empresas_cadastradas.xlsx");
  };

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(cadastrosFiltrados.length / itensPorPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = Math.min(inicio + itensPorPagina, cadastrosFiltrados.length);
  const cadastrosPagina = cadastrosFiltrados.slice(inicio, fim);

  // Reset para página 1 ao mudar filtros ou busca
  useEffect(() => {
    setPagina(1);
  }, [filtrosAtivos, busca, itensPorPagina]);

  // ── Contadores para mini-cards ──────────────────────────────────────────────
  const contSemOptin = useMemo(
    () => cadastros.filter((e) => e.autoriza_compartilhamento !== "Sim").length,
    [cadastros]
  );
  const contIncompletos = useMemo(
    () =>
      cadastros.filter((e) => calcularCompletude(e, socios[e.id] || []) < 100).length,
    [cadastros, socios]
  );
  const contCompletos = useMemo(
    () =>
      cadastros.filter((e) => calcularCompletude(e, socios[e.id] || []) === 100).length,
    [cadastros, socios]
  );
  const contPendentes = useMemo(
    () => cadastros.filter((e) => e.status_aprovacao === "pendente").length,
    [cadastros]
  );
  const contCnpjIrregulares = useMemo(
    () =>
      Object.values(situacoesCnpj).filter(
        (s) => s.situacao && s.situacao !== "ATIVA"
      ).length,
    [situacoesCnpj]
  );

  // ── Contagem de filtros ativos ──────────────────────────────────────────────
  const qtdFiltrosAtivos = useMemo(() => {
    let count = 0;
    if (filtrosAtivos.status !== "todos") count++;
    if (filtrosAtivos.optin !== "todos") count++;
    if (filtrosAtivos.completude !== "todos") count++;
    if (filtrosAtivos.portes.length > 0) count++;
    if (filtrosAtivos.tiposAcesso.length > 0) count++;
    if (filtrosAtivos.semLogo) count++;
    if (filtrosAtivos.semDocumentos) count++;
    if (filtrosAtivos.semSocios) count++;
    if (filtrosAtivos.semCeps) count++;
    if (filtrosAtivos.dataInicio) count++;
    if (filtrosAtivos.dataFim) count++;
    if (filtrosAtivos.ordenacao !== "recentes") count++;
    if (filtrosAtivos.situacaoCnpj !== "todos") count++;
    return count;
  }, [filtrosAtivos]);

  // ── Tags de filtros ativos ──────────────────────────────────────────────────
  function removerFiltro(chave: keyof FiltrosState) {
    setFiltrosAtivos((prev) => ({
      ...prev,
      [chave]:
        chave === "portes" || chave === "tiposAcesso"
          ? []
          : chave === "status"
          ? "todos"
          : chave === "optin"
          ? "todos"
          : chave === "completude"
          ? "todos"
          : chave === "ordenacao"
          ? "recentes"
          : chave === "situacaoCnpj"
          ? "todos"
          : typeof prev[chave] === "boolean"
          ? false
          : "",
    }));
  }

  const tagsFiltros: { label: string; chave: keyof FiltrosState }[] = [];
  if (filtrosAtivos.status !== "todos")
    tagsFiltros.push({
      label: filtrosAtivos.status === "pendente" ? "Pendentes" : filtrosAtivos.status === "suspenso" ? "Suspensos" : "Aprovados",
      chave: "status",
    });
  if (filtrosAtivos.optin !== "todos")
    tagsFiltros.push({
      label: filtrosAtivos.optin === "com_optin" ? "Com opt-in" : "Sem opt-in",
      chave: "optin",
    });
  if (filtrosAtivos.completude !== "todos")
    tagsFiltros.push({
      label: filtrosAtivos.completude === "completo" ? "Completo" : "Incompleto",
      chave: "completude",
    });
  if (filtrosAtivos.portes.length > 0)
    tagsFiltros.push({ label: `Porte: ${filtrosAtivos.portes.join(", ")}`, chave: "portes" });
  if (filtrosAtivos.tiposAcesso.length > 0)
    tagsFiltros.push({ label: `Tipo: ${filtrosAtivos.tiposAcesso.join(", ")}`, chave: "tiposAcesso" });
  if (filtrosAtivos.semLogo) tagsFiltros.push({ label: "Sem logo", chave: "semLogo" });
  if (filtrosAtivos.semDocumentos) tagsFiltros.push({ label: "Sem documentos", chave: "semDocumentos" });
  if (filtrosAtivos.semSocios) tagsFiltros.push({ label: "Sem sócios", chave: "semSocios" });
  if (filtrosAtivos.semCeps) tagsFiltros.push({ label: "Sem CEPs de impacto", chave: "semCeps" });
  if (filtrosAtivos.dataInicio) tagsFiltros.push({ label: `A partir de ${filtrosAtivos.dataInicio}`, chave: "dataInicio" });
  if (filtrosAtivos.dataFim) tagsFiltros.push({ label: `Até ${filtrosAtivos.dataFim}`, chave: "dataFim" });
  if (filtrosAtivos.ordenacao !== "recentes") {
    const labels: Record<string, string> = { antigos: "Mais antigos", nome_az: "Nome A→Z", nome_za: "Nome Z→A" };
    tagsFiltros.push({ label: `Ordem: ${labels[filtrosAtivos.ordenacao]}`, chave: "ordenacao" });
  }
  if (filtrosAtivos.situacaoCnpj !== "todos") {
    const labelsCnpj: Record<string, string> = {
      ATIVA: "CNPJ: Ativa",
      INAPTA: "CNPJ: Inapta",
      BAIXADA: "CNPJ: Baixada",
      SUSPENSA: "CNPJ: Suspensa",
      nao_verificado: "CNPJ: Não verificado",
    };
    tagsFiltros.push({ label: labelsCnpj[filtrosAtivos.situacaoCnpj] || `CNPJ: ${filtrosAtivos.situacaoCnpj}`, chave: "situacaoCnpj" });
  }

  // ── Ações do modal ──────────────────────────────────────────────────────────
  function abrirModal() {
    setFiltrosTemp(filtrosAtivos);
    setModalAberto(true);
  }

  function aplicarFiltros() {
    setFiltrosAtivos(filtrosTemp);
    setModalAberto(false);
  }

  function limparFiltros() {
    setFiltrosTemp(FILTROS_PADRAO);
  }

  // ── Páginas numéricas ───────────────────────────────────────────────────────
  function gerarNumeroPaginas(): (number | "...")[] {
    if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    const paginas: (number | "...")[] = [1];
    if (paginaAtual > 3) paginas.push("...");
    for (let i = Math.max(2, paginaAtual - 1); i <= Math.min(totalPaginas - 1, paginaAtual + 1); i++) {
      paginas.push(i);
    }
    if (paginaAtual < totalPaginas - 2) paginas.push("...");
    paginas.push(totalPaginas);
    return paginas;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <LayoutAdm>
      <div className="space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cadastros</h1>
            <p className="text-gray-600 mt-1">Gerencie todas as empresas cadastradas na plataforma.</p>
          </div>

          {!modoIA && (
            <div className="flex items-center gap-2">
              {/* Busca */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar empresa, CNPJ ou e-mail..."
                  className="pl-9 h-10 bg-white text-sm"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              {/* Botão Filtrar */}
              <button
                onClick={abrirModal}
                className={`relative inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border transition-colors ${
                  qtdFiltrosAtivos > 0
                    ? "bg-[#7030A0] text-white border-[#7030A0]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtrar
                {qtdFiltrosAtivos > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#7030A0] text-xs font-bold">
                    {qtdFiltrosAtivos}
                  </span>
                )}
              </button>
              
              {/* Botão Busca com IA */}
              <button
                onClick={abrirModoIA}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border transition-colors ${
                  modoIA
                    ? "bg-[#7030A0] text-white border-[#7030A0]"
                    : "bg-purple-50 text-[#7030A0] border-purple-200 hover:bg-purple-100"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Busca com IA</span>
                <span className="sm:hidden">IA</span>
              </button>

              {/* Botão Exportar Excel */}
              <button
                onClick={exportarParaExcel}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border transition-colors bg-white text-gray-700 border-gray-200 hover:bg-gray-50 whitespace-nowrap"
                title="Exportar dados para Excel"
              >
                <Download className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline">Exportar Excel</span>
              </button>

              {/* Botão Verificar CNPJs */}
              <button
                onClick={() => setModalVerificarAberto(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium border transition-colors bg-white text-gray-700 border-gray-200 hover:bg-gray-50 whitespace-nowrap"
                title="Verificar situação dos CNPJs na Receita Federal"
              >
                <RefreshCw className="w-4 h-4 text-[#7030A0]" />
                <span className="hidden sm:inline">Verificar CNPJs</span>
              </button>
            </div>
          )}
        </div>

        {/* Renderização condicional: IA vs Tabela normal */}
        {modoIA ? (
          <div className="space-y-6">
            {/* Cabeçalho do painel IA */}
            <div className="flex items-center justify-between">
              <button
                onClick={fecharModoIA}
                className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para a lista
              </button>
              <div className="flex items-center gap-2">
                {/* Botão Histórico */}
                <button
                  onClick={() => { setHistoricoAberto(true); carregarHistorico(); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-[#7030A0] dark:hover:text-purple-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 hover:border-[#7030A0] dark:hover:border-purple-500 transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  Histórico
                </button>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7030A0] dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-700">
                  <Sparkles className="w-3.5 h-3.5" />
                  Busca com IA
                </span>
              </div>
            </div>

            {/* Campo de descrição */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-400 dark:border-gray-600 p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Descreva o serviço ou produto que você precisa
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Quanto mais detalhes você fornecer, melhores serão os resultados. A IA irá analisar as atividades de todas as empresas cadastradas e encontrar as mais relevantes para você.
                </p>
                <Textarea
                  placeholder="Ex: Preciso de fornecedores de TI com experiência em infraestrutura..."
                  value={buscaIA}
                  onChange={(e) => { setBuscaIA(e.target.value); setErroIA(""); }}
                  rows={4}
                  className="resize-none border-gray-400 dark:border-gray-600 focus:border-[#7030A0] dark:focus:border-purple-400 dark:bg-gray-900 dark:text-white text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) executarBuscaIA();
                  }}
                />
                <p className="text-xs text-gray-400 mt-1.5">Dica: pressione Ctrl+Enter para buscar rapidamente.</p>
              </div>
              <button
                onClick={executarBuscaIA}
                disabled={carregandoIA}
                className="inline-flex items-center justify-center gap-2 px-6 h-11 bg-[#7030A0] hover:bg-purple-800 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {carregandoIA ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Buscar com IA
              </button>
            </div>

            {erroIA && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
                <X className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{erroIA}</p>
              </div>
            )}

            {resultadosIA.length > 0 && !carregandoIA && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 pl-1">
                  {resultadosIA.length} empresa{resultadosIA.length !== 1 ? "s" : ""} encontrada{resultadosIA.length !== 1 ? "s" : ""} pela IA
                </h3>
                <div className="grid gap-4">
                  {resultadosIA.map((emp, index) => (
                    <div
                      key={emp.id}
                      className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-700 transition-all flex flex-col sm:flex-row gap-5"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[#7030A0] dark:text-purple-300 font-bold flex items-center justify-center text-sm border border-purple-200 dark:border-purple-700/50">
                        {index + 1}º
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {emp.razao_social}
                            {emp.nome_fantasia && (
                              <span className="text-sm font-normal text-gray-500">
                                ({emp.nome_fantasia})
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {emp.email} • CNPJ: {emp.cnpj}
                          </p>
                        </div>
                        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-3 border border-purple-100 dark:border-purple-800/30">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                            <span className="font-semibold text-[#7030A0] dark:text-purple-400 not-italic mr-1">
                              Por que a IA recomendou:
                            </span>
                            {emp.justificativa}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex sm:flex-col justify-end sm:justify-start">
                        <Link href={`/adm/cadastros/${emp.id}`}>
                          <a className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-[#7030A0] text-gray-700 hover:text-white text-sm font-medium rounded-lg border border-gray-200 hover:border-[#7030A0] transition-colors group-hover:bg-[#7030A0] group-hover:text-white">
                            Ver detalhes
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sheet de Histórico ─────────────────────────────────────────── */}
            <Sheet open={historicoAberto} onOpenChange={setHistoricoAberto}>
              <SheetContent side="right" className="w-full sm:max-w-md flex flex-col h-full dark:bg-gray-900 dark:border-gray-700">
                <SheetHeader className="mb-6 space-y-2 shrink-0">
                  <SheetTitle className="flex items-center gap-2 text-gray-900 dark:text-white mt-4 sm:mt-0">
                    <History className="w-5 h-5 text-[#7030A0] dark:text-purple-400" />
                    Histórico de Buscas com IA
                  </SheetTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Acesse suas buscas recentes e restaure os resultados a qualquer momento sem precisar refazer a pesquisa.
                  </p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                  {carregandoHistorico ? (
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                    </div>
                  ) : historicoIA.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                      <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma busca com IA encontrada no histórico.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historicoIA.map((item: any) => {
                        const data = new Date(item.criado_em);
                        const dataFormatada = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                        const horaFormatada = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 hover:border-purple-200 dark:hover:border-purple-700 transition-colors">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                              <Clock className="w-3 h-3" />
                              {dataFormatada} às {horaFormatada}
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">
                              "{item.descricao}"
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.total_resultados} empresa{item.total_resultados !== 1 ? "s" : ""} encontrada{item.total_resultados !== 1 ? "s" : ""}
                            </p>
                            <button
                              onClick={() => restaurarDoBancoDoDados(item)}
                              className="w-full inline-flex items-center justify-center gap-2 py-2 text-sm font-medium text-[#7030A0] dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg border border-purple-200 dark:border-purple-700 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restaurar esta busca
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

          </div>
        ) : (
          <>
        {/* Mini-cards de atalho */}
        {!carregando && (
          <div className="grid grid-cols-2 lg:grid-cols-5 md:grid-cols-3 gap-3">
            <button
              onClick={() => {
                setFiltrosAtivos((prev) => ({ ...prev, status: "pendente" }));
              }}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{contPendentes}</div>
                <div className="text-xs text-gray-500 mt-0.5">Pendentes</div>
              </div>
            </button>

            <button
              onClick={() => {
                setFiltrosAtivos((prev) => ({ ...prev, optin: "sem_optin" }));
              }}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{contSemOptin}</div>
                <div className="text-xs text-gray-500 mt-0.5">Sem opt-in</div>
              </div>
            </button>

            <button
              onClick={() => {
                setFiltrosAtivos((prev) => ({ ...prev, completude: "completo" }));
              }}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{contCompletos}</div>
                <div className="text-xs text-gray-500 mt-0.5">Completos</div>
              </div>
            </button>

            <button
              onClick={() => {
                setFiltrosAtivos((prev) => ({ ...prev, completude: "incompleto" }));
              }}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{contIncompletos}</div>
                <div className="text-xs text-gray-500 mt-0.5">Incompletos</div>
              </div>
            </button>

            {/* Novo card: CNPJs Irregulares (Baixados / Inativos / Suspensos) */}
            <button
              onClick={() => {
                setFiltrosAtivos((prev) => ({ ...prev, situacaoCnpj: "irregular" }));
              }}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-colors text-left group"
              title="CNPJs com situação Baixada, Inapta ou Suspensa"
            >
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <ShieldOff className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 leading-none">{contCnpjIrregulares}</div>
                <div className="text-xs text-gray-500 mt-0.5">CNPJ irregular</div>
              </div>
            </button>
          </div>
        )}

        {/* Tags de filtros ativos */}
        {tagsFiltros.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 font-medium">Filtros ativos:</span>
            {tagsFiltros.map((tag) => (
              <span
                key={tag.chave}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium"
              >
                {tag.label}
                <button
                  onClick={() => removerFiltro(tag.chave)}
                  className="ml-0.5 hover:text-purple-900 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setFiltrosAtivos(FILTROS_PADRAO)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpar todos
            </button>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Empresa</th>
                  <th className="px-6 py-4 font-semibold">CNPJ</th>
                  <th className="px-6 py-4 font-semibold">Situação CNPJ</th>
                  <th className="px-6 py-4 font-semibold">Cadastro</th>
                  <th className="px-6 py-4 font-semibold">Data</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        <span>Carregando cadastros...</span>
                      </div>
                    </td>
                  </tr>
                ) : cadastrosPagina.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-base">
                      Nenhum cadastro encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  cadastrosPagina.map((emp) => {
                    const listaSocios = socios[emp.id] || [];
                    const completude = calcularCompletude(emp, listaSocios);
                    const semOptin = emp.autoriza_compartilhamento !== "Sim";
                    const cnpjSituacao = situacoesCnpj[emp.id];

                    return (
                      <tr
                        key={emp.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          emp.status_aprovacao === "pendente" ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold text-gray-900 truncate max-w-[200px]">
                                {emp.razao_social || "N/A"}
                              </div>
                              <div className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]">
                                {emp.email}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              {emp.status_aprovacao === "pendente" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 whitespace-nowrap">
                                  Pendente
                                </span>
                              )}
                              {emp.status_aprovacao === "suspenso" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-800 text-xs font-semibold border border-gray-300 whitespace-nowrap">
                                  Suspenso
                                </span>
                              )}
                              {semOptin && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold border border-red-200 whitespace-nowrap">
                                  Sem opt-in
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {emp.cnpj || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <BadgeSituacaoCNPJ
                            situacao={cnpjSituacao?.situacao ?? null}
                            verificadoEm={cnpjSituacao?.verificado_em ?? null}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <BarraCompletude porcentagem={completude} />
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {emp.created_at
                            ? new Date(emp.created_at).toLocaleDateString("pt-BR")
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/adm/cadastros/${emp.id}`}>
                            <a className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#7030A0] border border-[#7030A0]/40 rounded-lg hover:bg-[#7030A0] hover:text-white hover:border-[#7030A0] transition-all duration-200 group">
                              Detalhes
                              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </a>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da tabela: itens por página + paginação */}
          {!carregando && cadastrosFiltrados.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Itens por página + contador */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Mostrar</span>
                <Select
                  value={String(itensPorPagina)}
                  onValueChange={(v) => setItensPorPagina(Number(v))}
                >
                  <SelectTrigger className="w-20 h-8 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-500">
                  Exibindo{" "}
                  <span className="font-medium text-gray-900">
                    {inicio + 1}–{fim}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium text-gray-900">
                    {cadastrosFiltrados.length}
                  </span>{" "}
                  resultados
                </span>
              </div>

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {gerarNumeroPaginas().map((p, idx) =>
                    p === "..." ? (
                      <span key={`ellipsis-${idx}`} className="w-8 text-center text-gray-400 text-sm">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPagina(p as number)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          paginaAtual === p
                            ? "bg-[#7030A0] text-white border border-[#7030A0]"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </>
      )}
      </div>

      {/* ── Modal de Filtros ───────────────────────────────────────────────────── */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <SlidersHorizontal className="w-5 h-5 text-[#7030A0]" />
              Filtros Avançados
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">

            {/* Status */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Status de Aprovação</p>
              <div className="flex gap-2 flex-wrap">
                {(["todos", "pendente", "aprovado", "suspenso"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, status: s }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.status === s
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s === "todos" ? "Todos" : s === "pendente" ? "⏳ Pendentes" : s === "suspenso" ? "⚠️ Suspensos" : "✅ Aprovados"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Opt-in */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Opt-in (Autorização)</p>
              <div className="flex gap-2 flex-wrap">
                {(["todos", "com_optin", "sem_optin"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, optin: o }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.optin === o
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {o === "todos" ? "Todos" : o === "com_optin" ? "✓ Com opt-in" : "✕ Sem opt-in"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Completude */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Completude do Cadastro</p>
              <div className="flex gap-2 flex-wrap">
                {(["todos", "completo", "incompleto"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, completude: c }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.completude === c
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {c === "todos" ? "Todos" : c === "completo" ? "100% Completo" : "Incompleto"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Tipo de Acesso */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Tipo de Acesso</p>
              <div className="grid gap-2">
                {TIPOS_ACESSO_DISPONIVEIS.map((tipo) => (
                  <div key={tipo} className="flex items-center gap-2">
                    <Checkbox
                      id={`tipo-${tipo}`}
                      checked={filtrosTemp.tiposAcesso.includes(tipo)}
                      onCheckedChange={(checked) => {
                        setFiltrosTemp((p) => ({
                          ...p,
                          tiposAcesso: checked
                            ? [...p.tiposAcesso, tipo]
                            : p.tiposAcesso.filter((x) => x !== tipo),
                        }));
                      }}
                    />
                    <Label htmlFor={`tipo-${tipo}`} className="text-sm cursor-pointer">
                      {tipo}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

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
                          portes: checked
                            ? [...p.portes, porte]
                            : p.portes.filter((x) => x !== porte),
                        }));
                      }}
                    />
                    <Label htmlFor={`porte-${porte}`} className="text-sm cursor-pointer">
                      {porte}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Período */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Período de Cadastro</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">A partir de</Label>
                  <Input
                    type="date"
                    value={filtrosTemp.dataInicio}
                    onChange={(e) =>
                      setFiltrosTemp((p) => ({ ...p, dataInicio: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Até</Label>
                  <Input
                    type="date"
                    value={filtrosTemp.dataFim}
                    onChange={(e) =>
                      setFiltrosTemp((p) => ({ ...p, dataFim: e.target.value }))
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados faltantes */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Dados Faltantes</p>
              <div className="space-y-2.5">
                {[
                  { key: "semLogo", label: "Sem logo da empresa" },
                  { key: "semDocumentos", label: "Sem documentos (CNPJ / Junta)" },
                  { key: "semSocios", label: "Sem sócios cadastrados" },
                  { key: "semCeps", label: "Sem CEPs de impacto" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={filtrosTemp[key as keyof FiltrosState] as boolean}
                      onCheckedChange={(checked) =>
                        setFiltrosTemp((p) => ({ ...p, [key]: checked === true }))
                      }
                    />
                    <Label htmlFor={key} className="text-sm cursor-pointer">
                      {label}
                    </Label>
                  </div>
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
                    onClick={() =>
                      setFiltrosTemp((p) => ({ ...p, ordenacao: value }))
                    }
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                      filtrosTemp.ordenacao === value
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Situação do CNPJ */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Situação do CNPJ</p>
              <p className="text-xs text-gray-400 mb-2">
                Filtra por situação cadastral na Receita Federal. Empresas não verificadas não aparecerão, a não ser que selecione "Não verificado".
              </p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: "todos", label: "Todos" },
                  { value: "ATIVA", label: "🟢 Ativa" },
                  { value: "INAPTA", label: "🟠 Inapta" },
                  { value: "BAIXADA", label: "🔴 Baixada" },
                  { value: "SUSPENSA", label: "🟡 Suspensa" },
                  { value: "nao_verificado", label: "⚪ Não verificado" },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, situacaoCnpj: value }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.situacaoCnpj === value
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={limparFiltros}
              className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Limpar Filtros
            </Button>
            <Button
              onClick={aplicarFiltros}
              className="flex-1 bg-[#7030A0] hover:bg-purple-800 text-white"
            >
              Aplicar Filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Verificação de CNPJs ───────────────────────────────────────── */}
      <ModalVerificarCNPJs
        aberto={modalVerificarAberto}
        onFechar={() => setModalVerificarAberto(false)}
        empresas={cadastros}
        situacoes={situacoesCnpj}
        onAtualizarSituacao={atualizarSituacaoCnpj}
      />
    </LayoutAdm>
  );
}
