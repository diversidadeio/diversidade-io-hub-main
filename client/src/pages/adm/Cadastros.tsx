import { useEffect, useState, useMemo } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

type StatusAprovacao = "todos" | "pendente" | "aprovado";
type OptinFiltro = "todos" | "com_optin" | "sem_optin";
type CompletudeFiltro = "todos" | "completo" | "incompleto";
type OrdenacaoFiltro =
  | "recentes"
  | "antigos"
  | "nome_az"
  | "nome_za";

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
  "logo_empresa_url",
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CadastrosAdm() {
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [socios, setSocios] = useState<Record<string, any[]>>({});
  const [ceps, setCeps] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

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
        const { data, error } = await supabase
          .from("empresas")
          .select(
            `id, razao_social, cnpj, email, created_at, nome_responsavel,
             status_aprovacao, autoriza_compartilhamento, porte_empresa,
             area_empresa, sobre_empresa, logo_empresa_url, cartao_cnpj_url,
             ficha_junta_url, telefone_principal, acesso_tipo, atividade_empresarial`
          )
          .neq("tipo_usuario", "adm")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCadastros(data || []);

        // Buscar sócios com todos os campos necessários para cálculo de completude
        const { data: sociosData } = await supabase
          .from("socios")
          .select(
            "empresa_id, nome, cpf, email, cep, data_nascimento, nacionalidade, raca, genero, participacao_percentual, participacao_valor"
          );
        const sociosMap: Record<string, any[]> = {};
        (sociosData || []).forEach((s: any) => {
          if (!sociosMap[s.empresa_id]) sociosMap[s.empresa_id] = [];
          sociosMap[s.empresa_id].push(s);
        });
        setSocios(sociosMap);

        // Buscar quais empresas têm CEPs de impacto
        const { data: cepsData } = await supabase
          .from("ceps_impactados")
          .select("empresa_id");
        const cepsMap: Record<string, boolean> = {};
        (cepsData || []).forEach((c: any) => {
          cepsMap[c.empresa_id] = true;
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
        !filtrosAtivos.semCeps || !ceps[emp.id];

      const matchDataInicio =
        !filtrosAtivos.dataInicio ||
        new Date(emp.created_at) >= new Date(filtrosAtivos.dataInicio);

      const matchDataFim =
        !filtrosAtivos.dataFim ||
        new Date(emp.created_at) <=
          new Date(filtrosAtivos.dataFim + "T23:59:59");

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
        matchDataFim
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
  }, [cadastros, socios, ceps, busca, filtrosAtivos]);

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
  const contPendentes = useMemo(
    () => cadastros.filter((e) => e.status_aprovacao === "pendente").length,
    [cadastros]
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
          : typeof prev[chave] === "boolean"
          ? false
          : "",
    }));
  }

  const tagsFiltros: { label: string; chave: keyof FiltrosState }[] = [];
  if (filtrosAtivos.status !== "todos")
    tagsFiltros.push({
      label: filtrosAtivos.status === "pendente" ? "Pendentes" : "Aprovados",
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
          </div>
        </div>

        {/* Mini-cards de atalho */}
        {!carregando && (
          <div className="grid grid-cols-3 gap-3">
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
                  <th className="px-6 py-4 font-semibold">Responsável</th>
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
                        <td className="px-6 py-4 text-gray-600 truncate max-w-[180px]">
                          {emp.nome_responsavel || "N/A"}
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
                {(["todos", "pendente", "aprovado"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, status: s }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.status === s
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s === "todos" ? "Todos" : s === "pendente" ? "⏳ Pendentes" : "✅ Aprovados"}
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
    </LayoutAdm>
  );
}
