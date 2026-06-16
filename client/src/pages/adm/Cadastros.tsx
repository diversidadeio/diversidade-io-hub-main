import { useEffect, useState } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function CadastrosAdm() {
  const [cadastros, setCadastros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregarCadastros() {
      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('id, razao_social, cnpj, email, created_at, nome_responsavel')
          .neq('tipo_usuario', 'adm')
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
  }, []);

  const cadastrosFiltrados = cadastros.filter(emp => {
    const termo = busca.toLowerCase();
    return (
      (emp.razao_social && emp.razao_social.toLowerCase().includes(termo)) ||
      (emp.cnpj && emp.cnpj.includes(termo)) ||
      (emp.email && emp.email.toLowerCase().includes(termo))
    );
  });

  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cadastros</h1>
            <p className="text-gray-600 mt-1">Gerencie todas as empresas cadastradas na plataforma.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input 
              placeholder="Buscar empresa, CNPJ ou e-mail..." 
              className="pl-10 h-11 bg-white"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Empresa</th>
                  <th className="px-6 py-4 font-semibold">CNPJ</th>
                  <th className="px-6 py-4 font-semibold">Responsável</th>
                  <th className="px-6 py-4 font-semibold">Data Cadastro</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        <span>Carregando cadastros...</span>
                      </div>
                    </td>
                  </tr>
                ) : cadastrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-base">
                      Nenhum cadastro encontrado.
                    </td>
                  </tr>
                ) : (
                  cadastrosFiltrados.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 truncate max-w-[250px]">
                          {emp.razao_social || 'N/A'}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5 truncate max-w-[250px]">{emp.email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{emp.cnpj || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-600 truncate max-w-[200px]">{emp.nome_responsavel || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {emp.created_at ? new Date(emp.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/adm/cadastros/${emp.id}`}>
                          <a className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#7030A0] hover:bg-purple-800 rounded-lg transition-colors">
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
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Mostrando <span className="font-medium text-gray-900">{cadastrosFiltrados.length}</span> resultados
              </span>
            </div>
          )}
        </div>
      </div>
    </LayoutAdm>
  );
}
