import { useEffect, useState } from "react";
import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, Clock, CalendarDays } from "lucide-react";
import { Link } from "wouter";

export default function DashboardAdm() {
  const [metricas, setMetricas] = useState({
    total: 0,
    optin: 0,
    novos7dias: 0,
    aguardando: 0,
  });
  const [recentes, setRecentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      try {
        // Total
        const { count: total } = await supabase.from('empresas')
          .select('*', { count: 'exact', head: true })
          .neq('tipo_usuario', 'adm');
        
        // Optin
        const { count: optin } = await supabase.from('empresas')
          .select('*', { count: 'exact', head: true })
          .eq('autoriza_compartilhamento', 'Sim')
          .neq('tipo_usuario', 'adm');
        
        // 7 dias
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
        const { count: novos } = await supabase.from('empresas')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', umaSemanaAtras.toISOString())
          .neq('tipo_usuario', 'adm');
          
        // Recentes
        const { data: rec } = await supabase.from('empresas')
          .select('id, razao_social, cnpj, created_at, email')
          .neq('tipo_usuario', 'adm')
          .order('created_at', { ascending: false })
          .limit(10);

        setMetricas({
          total: total || 0,
          optin: optin || 0,
          novos7dias: novos || 0,
          aguardando: 0, // Placeholder se houver validação futura
        });
        setRecentes(rec || []);
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, []);

  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Visão geral dos cadastros da plataforma Diversidade.io</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Cadastros</CardTitle>
              <Users className="w-5 h-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{carregando ? "..." : metricas.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Com Opt-in</CardTitle>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{carregando ? "..." : metricas.optin}</div>
              <p className="text-xs text-gray-500 mt-1">
                {metricas.total > 0 ? Math.round((metricas.optin / metricas.total) * 100) : 0}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Novos (7 dias)</CardTitle>
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{carregando ? "..." : metricas.novos7dias}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Aguardando Ação</CardTitle>
              <Clock className="w-5 h-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{carregando ? "..." : metricas.aguardando}</div>
              <p className="text-xs text-gray-500 mt-1">Validação pendente</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Recentes */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Cadastros Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium">CNPJ</th>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {carregando ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Carregando...</td>
                    </tr>
                  ) : recentes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum cadastro encontrado.</td>
                    </tr>
                  ) : (
                    recentes.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[200px]">
                          {emp.razao_social || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{emp.cnpj || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{emp.email}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {emp.created_at ? new Date(emp.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/adm/cadastros/${emp.id}`}>
                            <a className="text-[#7030A0] hover:underline font-medium text-sm">Ver Detalhes</a>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <Link href="/adm/cadastros">
                <a className="text-sm font-semibold text-[#7030A0] hover:underline">Ver todos os cadastros →</a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutAdm>
  );
}
