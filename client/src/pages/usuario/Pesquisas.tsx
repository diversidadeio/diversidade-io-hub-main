import { useEffect, useState, useRef } from "react";
import { LayoutUsuario } from "@/components/LayoutUsuario";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";

const OPCOES_POR_PAGINA = [10, 20, 50, 100];

export default function Pesquisas() {
  const { usuario } = useAuth();
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          .select('id, razao_social, cnpj, email, created_at, nome_responsavel')
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
      } catch (err) {
        console.error("Erro ao carregar cadastros:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarCadastros();
  }, [usuario]);

  // Filtragem por termo de busca
  const cadastrosFiltrados = cadastros.filter(emp => {
    const termo = busca.toLowerCase();
    return (
      (emp.razao_social && emp.razao_social.toLowerCase().includes(termo)) ||
      (emp.cnpj && emp.cnpj.includes(termo)) ||
      (emp.email && emp.email.toLowerCase().includes(termo))
    );
  });

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pesquisa de Empresas</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Encontre outras empresas parceiras cadastradas na plataforma.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar empresa, CNPJ ou e-mail..."
              className="pl-10 h-11 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Empresa</th>
                  <th className="px-6 py-4 font-semibold">CNPJ</th>
                  <th className="px-6 py-4 font-semibold">Responsável</th>
                  <th className="px-6 py-4 font-semibold">Data Cadastro</th>
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
                  cadastrosPagina.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[250px]">
                          {emp.razao_social || 'N/A'}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate max-w-[250px]">{emp.email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{emp.cnpj || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{emp.nome_responsavel || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {emp.created_at ? new Date(emp.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/empresas/${emp.id}`}>
                          <a className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#7030A0] hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 rounded-lg transition-colors">
                            Ver Detalhes
                          </a>
                        </Link>
                      </td>
                    </tr>
                  ))
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
    </LayoutUsuario>
  );
}
