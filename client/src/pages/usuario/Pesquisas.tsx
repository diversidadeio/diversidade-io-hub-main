import { useEffect, useState, useRef } from "react";
import { LayoutUsuario } from "@/components/LayoutUsuario";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { registrarLog } from "@/lib/registrarLog";

export default function Pesquisas() {
  const { usuario } = useAuth();
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Log de pesquisa com debounce de 1 segundo
  const handleBusca = (valor: string) => {
    setBusca(valor);
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

        const { data, error } = await supabase
          .from('empresas')
          .select('id, razao_social, cnpj, email, created_at, nome_responsavel')
          .neq('tipo_usuario', 'adm')
          .neq('id', empresaId) 
          .order('created_at', { ascending: false });

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

  const cadastrosFiltrados = cadastros.filter(emp => {
    const termo = busca.toLowerCase();
    return (
      (emp.razao_social && emp.razao_social.toLowerCase().includes(termo)) ||
      (emp.cnpj && emp.cnpj.includes(termo)) ||
      (emp.email && emp.email.toLowerCase().includes(termo))
    );
  });

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
                ) : cadastrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-base">
                      Nenhuma empresa encontrada com os critérios de busca.
                    </td>
                  </tr>
                ) : (
                  cadastrosFiltrados.map((emp) => (
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
          
          {!carregando && cadastrosFiltrados.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando <span className="font-medium text-gray-900 dark:text-white">{cadastrosFiltrados.length}</span> resultados
              </span>
            </div>
          )}
        </div>
      </div>
    </LayoutUsuario>
  );
}
