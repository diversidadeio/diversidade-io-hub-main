import { useEffect, useState, useRef, useMemo } from "react";
import { LayoutUsuario } from "@/components/LayoutUsuario";
import { supabase, supabaseAnon } from "@/lib/supabase";
import { Link } from "wouter";
import { Search, Loader2, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";

type OrdenacaoFiltro = "recentes" | "antigos" | "nome_az" | "nome_za";
type CompletudeFiltro = "todos" | "completo" | "incompleto";

interface FiltrosState {
  portes: string[];
  completude: CompletudeFiltro;
  ordenacao: OrdenacaoFiltro;
  etariedade_60: boolean;
  racas: string[];
  sexos: string[];
}

const FILTROS_PADRAO: FiltrosState = {
  portes: [],
  completude: "todos",
  ordenacao: "recentes",
  etariedade_60: false,
  racas: [],
  sexos: [],
};

const PORTES_DISPONIVEIS = ["MEI", "ME", "MICRO", "EPP", "Média Empresa", "Grande Empresa"];
const RACAS_DISPONIVEIS = ["Pardo", "Preto", "Branco", "Amarelo", "Indígena", "Outro"];
const SEXOS_DISPONIVEIS = ["Masculino", "Feminino", "Outro", "Prefiro não declarar"];

const CAMPOS_OBRIGATORIOS = [
  "razao_social",
  "cnpj",
  "nome_responsavel",
  "telefone_principal",
  "area_empresa",
  "sobre_empresa",
  "logo_empresa_url",
];

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

function socioCompleto(socio: any): boolean {
  return CAMPOS_SOCIO_OBRIGATORIOS.every(
    (campo) => socio[campo] != null && String(socio[campo]).trim() !== ""
  );
}

function calcularCompletude(emp: any, listaSocios: any[]): number {
  const total = CAMPOS_OBRIGATORIOS.length + 1;
  let preenchidos = 0;
  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (emp[campo] && String(emp[campo]).trim() !== "") preenchidos++;
  }
  if (listaSocios.length > 0 && listaSocios.every(socioCompleto)) preenchidos++;
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
      <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cor}`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{porcentagem}%</span>
    </div>
  );
}

const OPCOES_POR_PAGINA = [10, 20, 50, 100];

export default function Pesquisas() {
  const { usuario } = useAuth();
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [isIncentivadora, setIsIncentivadora] = useState(false);

  useEffect(() => {
    async function checkIncentivadora() {
        if (!usuario) return;
        const { data } = await supabase.from('empresas').select('acesso_tipo').eq('id', (usuario as any).empresaId).single();
        if (data?.acesso_tipo && data.acesso_tipo.toUpperCase().includes('EMPRESA OU INICIATIVA INCENTIVADORA')) {
            setIsIncentivadora(true);
        }
    }
    checkIncentivadora();
  }, [usuario]);
  const [socios, setSocios] = useState<Record<string, any[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtros
  const [modalAberto, setModalAberto] = useState(false);
  const [filtrosTemp, setFiltrosTemp] = useState<FiltrosState>(FILTROS_PADRAO);
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosState>(FILTROS_PADRAO);

  // Log de pesquisa com debounce de 1 segundo
  const handleBusca = (valor: string) => {
    setBusca(valor);
    setPaginaAtual(1); // Volta à primeira página ao buscar
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (valor.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        registrarLog({
          tipo_evento: 'usuario_pesquisa_empresa',
          email: usuario?.email,
          empresa_id: (usuario as any)?.empresaId,
          detalhes: `Termo buscado: "${valor.trim()}"`,
        });
      }, 1000);
    }
  };

  useEffect(() => {
    async function carregarCadastros() {
      if (!usuario) return;
      try {
        const empresaId = (usuario as any).empresaId;

        // Busca IDs de empresas com solicitação de exclusão pendente
        const { data: exclusoesPendentes } = await supabase
          .from('solicitacoes_exclusao')
          .select('empresa_id')
          .eq('status', 'pendente');

        const idsComExclusaoPendente = (exclusoesPendentes || []).map(
          (s: any) => s.empresa_id
        );

        // Busca empresas aprovadas, com opt-in ativo, sem solicitação de exclusão pendente
        // e que não sejam do tipo "EMPRESA OU INICIATIVA INCENTIVADORA"
        let query = supabase
          .from('empresas')
          .select('id, razao_social, cnpj, email, created_at, nome_responsavel, porte_empresa, telefone_principal, area_empresa, sobre_empresa, logo_empresa_url')
          .neq('tipo_usuario', 'adm')
          .neq('id', empresaId)
          .eq('status_aprovacao', 'aprovado')
          .eq('autoriza_compartilhamento', 'Sim')
          .not('acesso_tipo', 'ilike', '%EMPRESA OU INICIATIVA INCENTIVADORA%')
          .order('created_at', { ascending: false });

        if (idsComExclusaoPendente.length > 0) {
          query = query.not('id', 'in', `(${idsComExclusaoPendente.join(',')})`);
        }

        const { data, error } = await query;

        if (error) throw error;
        setCadastros(data || []);

        // Buscar sócios para completude
        const { data: sociosData } = await supabaseAnon
          .from("socios")
          .select("empresa_id, nome, cpf, email, cep, data_nascimento, nacionalidade, raca, sexo, etariedade, participacao_percentual, participacao_valor");
        
        const sociosMap: Record<string, any[]> = {};
        (sociosData || []).forEach((s: any) => {
          if (!sociosMap[s.empresa_id]) sociosMap[s.empresa_id] = [];
          sociosMap[s.empresa_id].push(s);
        });
        setSocios(sociosMap);
      } catch (err) {
        console.error("Erro ao carregar cadastros:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarCadastros();
  }, [usuario]);

  // Filtros e ordenação
  const cadastrosFiltrados = useMemo(() => {
    let lista = cadastros.filter(emp => {
      const termo = busca.toLowerCase();
      const termoSemPontuacao = termo.replace(/[^\d]/g, '');
      const cnpjLimpo = emp.cnpj ? emp.cnpj.replace(/[^\d]/g, '') : '';
      
      const matchBusca =
        !termo ||
        (emp.razao_social && emp.razao_social.toLowerCase().includes(termo)) ||
        (emp.email && emp.email.toLowerCase().includes(termo)) ||
        (termoSemPontuacao && cnpjLimpo.includes(termoSemPontuacao));

      const matchPorte =
        filtrosAtivos.portes.length === 0 ||
        (emp.porte_empresa && filtrosAtivos.portes.includes(emp.porte_empresa));

      const listaSocios = socios[emp.id] || [];
      const completude = calcularCompletude(emp, listaSocios);
      const matchCompletude =
        filtrosAtivos.completude === "todos" ||
        (filtrosAtivos.completude === "completo" && completude === 100) ||
        (filtrosAtivos.completude === "incompleto" && completude < 100);

      const matchEtariedade =
        !filtrosAtivos.etariedade_60 ||
        listaSocios.some((s: any) => {
          const e = parseInt(s.etariedade);
          return !isNaN(e) && e >= 60;
        });

      const matchRaca =
        filtrosAtivos.racas.length === 0 ||
        listaSocios.some((s: any) => filtrosAtivos.racas.includes(s.raca));

      const matchSexo =
        filtrosAtivos.sexos.length === 0 ||
        listaSocios.some((s: any) => s.sexo && filtrosAtivos.sexos.some((fs: string) => s.sexo.startsWith(fs)));

      return matchBusca && matchPorte && matchCompletude && matchEtariedade && matchRaca && matchSexo;
    });

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
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return lista;
  }, [cadastros, socios, busca, filtrosAtivos]);

  // Contagem de filtros ativos
  const qtdFiltrosAtivos = useMemo(() => {
    let count = 0;
    if (filtrosAtivos.portes.length > 0) count++;
    if (filtrosAtivos.completude !== "todos") count++;
    if (filtrosAtivos.ordenacao !== "recentes") count++;
    if (filtrosAtivos.etariedade_60) count++;
    if (filtrosAtivos.racas.length > 0) count++;
    if (filtrosAtivos.sexos.length > 0) count++;
    return count;
  }, [filtrosAtivos]);

  function removerFiltro(chave: keyof FiltrosState) {
    setFiltrosAtivos((prev) => {
      const next: any = { ...prev };
      if (chave === "portes" || chave === "racas" || chave === "sexos") next[chave] = [];
      else if (chave === "etariedade_60") next[chave] = false;
      else if (chave === "ordenacao") next[chave] = "recentes";
      else if (chave === "completude") next[chave] = "todos";
      return next as FiltrosState;
    });
  }

  const tagsFiltros: { label: string; chave: keyof FiltrosState }[] = [];
  if (filtrosAtivos.portes.length > 0) tagsFiltros.push({ label: `Porte: ${filtrosAtivos.portes.join(", ")}`, chave: "portes" });
  if (filtrosAtivos.completude !== "todos") tagsFiltros.push({ label: filtrosAtivos.completude === "completo" ? "Completo" : "Incompleto", chave: "completude" });
  if (filtrosAtivos.ordenacao !== "recentes") {
    const labels: Record<string, string> = { antigos: "Mais antigos", nome_az: "Nome A→Z", nome_za: "Nome Z→A" };
    tagsFiltros.push({ label: `Ordem: ${labels[filtrosAtivos.ordenacao]}`, chave: "ordenacao" });
  }
  if (filtrosAtivos.etariedade_60) tagsFiltros.push({ label: "Sócios 60+", chave: "etariedade_60" });
  if (filtrosAtivos.racas.length > 0) tagsFiltros.push({ label: `Raça: ${filtrosAtivos.racas.join(", ")}`, chave: "racas" });
  if (filtrosAtivos.sexos.length > 0) tagsFiltros.push({ label: `Sexo: ${filtrosAtivos.sexos.join(", ")}`, chave: "sexos" });

  function abrirModal() { setFiltrosTemp(filtrosAtivos); setModalAberto(true); }
  function aplicarFiltros() { setFiltrosAtivos(filtrosTemp); setModalAberto(false); setPaginaAtual(1); }
  function limparFiltros() { setFiltrosTemp(FILTROS_PADRAO); }

  // Paginação
  const totalResultados = cadastrosFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalResultados / porPagina));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  const fim = inicio + porPagina;
  const cadastrosPagina = cadastrosFiltrados.slice(inicio, fim);

  const handlePorPagina = (valor: number) => {
    setPorPagina(valor);
    setPaginaAtual(1);
  };

  // Gera lista de páginas visíveis (máx. 5 ao redor da atual)
  const gerarPaginas = () => {
    const paginas: (number | '...')[] = [];
    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
    } else {
      paginas.push(1);
      if (paginaSegura > 3) paginas.push('...');
      for (let i = Math.max(2, paginaSegura - 1); i <= Math.min(totalPaginas - 1, paginaSegura + 1); i++) {
        paginas.push(i);
      }
      if (paginaSegura < totalPaginas - 2) paginas.push('...');
      paginas.push(totalPaginas);
    }
    return paginas;
  };

  return (
    <LayoutUsuario activePath="/meu-cadastro/pesquisas">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pesquisa de Empresas</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Encontre outras empresas parceiras cadastradas na plataforma.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar empresa, CNPJ ou e-mail..."
                className="pl-10 h-11 w-full bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                value={busca}
                onChange={(e) => handleBusca(e.target.value)}
              />
            </div>
            <button
              onClick={abrirModal}
              className={`relative inline-flex flex-shrink-0 items-center justify-center gap-2 h-11 px-6 rounded-lg text-sm font-medium border transition-colors ${
                qtdFiltrosAtivos > 0
                  ? "bg-[#7030A0] text-white border-[#7030A0]"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {qtdFiltrosAtivos > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#7030A0] text-xs font-bold">
                  {qtdFiltrosAtivos}
                </span>
              )}
            </button>
          </div>

        {tagsFiltros.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Filtros ativos:</span>
            {tagsFiltros.map((tag) => (
              <span
                key={tag.chave}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium"
              >
                {tag.label}
                <button
                  onClick={() => removerFiltro(tag.chave)}
                  className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => { setFiltrosAtivos(FILTROS_PADRAO); setPaginaAtual(1); }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              Limpar todos
            </button>
          </div>
        )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Empresa</th>
                  <th className="px-6 py-4 font-semibold">CNPJ</th>
                  <th className="px-6 py-4 font-semibold">Responsável</th>
                  <th className="px-6 py-4 font-semibold">Cadastro</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
                        <span>Carregando empresas...</span>
                      </div>
                    </td>
                  </tr>
                ) : cadastrosPagina.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-base">
                      Nenhuma empresa encontrada com os critérios de busca.
                    </td>
                  </tr>
                ) : (
                  cadastrosPagina.map((emp) => {
                    const listaSocios = socios[emp.id] || [];
                    const completude = calcularCompletude(emp, listaSocios);

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[250px]">
                            {emp.razao_social || 'N/A'}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate max-w-[250px]">{emp.email}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{emp.cnpj || 'N/A'}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{emp.nome_responsavel || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <BarraCompletude porcentagem={completude} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/empresas/${emp.id}`}>
                            <a className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#7030A0] hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 rounded-lg transition-colors">
                              Ver Detalhes
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

          {/* Rodapé: seletor de itens por página + paginação */}
          {!carregando && totalResultados > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Esquerda: seletor + contagem */}
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span>Mostrar</span>
                <select
                  value={porPagina}
                  onChange={(e) => handlePorPagina(Number(e.target.value))}
                  className="h-8 px-2 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {OPCOES_POR_PAGINA.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span>
                  Exibindo{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {inicio + 1}–{Math.min(fim, totalResultados)}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium text-gray-900 dark:text-white">{totalResultados}</span>{" "}
                  resultado{totalResultados !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Direita: navegação de páginas */}
              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                    disabled={paginaSegura === 1}
                    className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {gerarPaginas().map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPaginaAtual(p as number)}
                        className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-medium border transition-colors ${
                          p === paginaSegura
                            ? "bg-[#7030A0] text-white border-[#7030A0]"
                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaSegura === totalPaginas}
                    className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <SlidersHorizontal className="w-5 h-5 text-[#7030A0] dark:text-purple-400" />
              Filtros Avançados
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Porte */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Porte da Empresa</p>
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
                    <Label htmlFor={`porte-${porte}`} className="text-sm cursor-pointer dark:text-gray-300">
                      {porte}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="dark:border-gray-700" />

            {/* Completude */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Preenchimento do Cadastro</p>
              <div className="flex gap-2 flex-wrap">
                {(["todos", "completo", "incompleto"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFiltrosTemp((p) => ({ ...p, completude: c }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filtrosTemp.completude === c
                        ? "bg-[#7030A0] text-white border-[#7030A0]"
                        : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {c === "todos" ? "Todos" : c === "completo" ? "Completo" : "Incompleto"}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="dark:border-gray-700" />

            {/* Ordenação */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ordenação</p>
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
                        : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

            {/* Filtro: Sócios 60+ */}
            {isIncentivadora && (
              <>
                <Separator className="dark:border-gray-700" />
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Perfil dos Sócios</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filtro-etariedade"
                      checked={filtrosTemp.etariedade_60}
                      onCheckedChange={(checked) =>
                        setFiltrosTemp((prev) => ({ ...prev, etariedade_60: !!checked }))
                      }
                    />
                    <Label htmlFor="filtro-etariedade" className="text-gray-700 dark:text-gray-300 font-normal">
                      Ter alguém 60+ (Etariedade)
                    </Label>
                  </div>

                  <h5 className="font-medium text-sm text-gray-800 dark:text-gray-200 mt-4 mb-2">Raça</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {RACAS_DISPONIVEIS.map((raca) => (
                      <div key={raca} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filtro-raca-${raca}`}
                          checked={filtrosTemp.racas.includes(raca)}
                          onCheckedChange={(checked) => {
                            setFiltrosTemp((prev) => ({
                              ...prev,
                              racas: checked
                                ? [...prev.racas, raca]
                                : prev.racas.filter((r) => r !== raca),
                            }));
                          }}
                        />
                        <Label htmlFor={`filtro-raca-${raca}`} className="text-gray-700 dark:text-gray-300 font-normal truncate">
                          {raca}
                        </Label>
                      </div>
                    ))}
                  </div>

                  <h5 className="font-medium text-sm text-gray-800 dark:text-gray-200 mt-4 mb-2">Sexo</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {SEXOS_DISPONIVEIS.map((sexo) => (
                      <div key={sexo} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filtro-sexo-${sexo}`}
                          checked={filtrosTemp.sexos.includes(sexo)}
                          onCheckedChange={(checked) => {
                            setFiltrosTemp((prev) => ({
                              ...prev,
                              sexos: checked
                                ? [...prev.sexos, sexo]
                                : prev.sexos.filter((s) => s !== sexo),
                            }));
                          }}
                        />
                        <Label htmlFor={`filtro-sexo-${sexo}`} className="text-gray-700 dark:text-gray-300 font-normal truncate">
                          {sexo}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          <DialogFooter className="flex flex-row justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={limparFiltros}
              className="flex-1 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
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
    </LayoutUsuario>
  );
}
