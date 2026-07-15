import { LayoutAdm } from "@/components/adm/LayoutAdm";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Solicitacao {
  id: string;
  empresa_id: string;
  email: string;
  razao_social: string;
  status: 'pendente' | 'concluida' | 'revertida';
  motivo: string | null;
  criado_em: string;
}

export default function ExclusoesAdm() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<Solicitacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [exibirSucesso, setExibirSucesso] = useState(false);
  const [nomeExcluido, setNomeExcluido] = useState("");

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  const carregarSolicitacoes = async () => {
    try {
      const { data, error } = await supabase
        .from("solicitacoes_exclusao")
        .select("*")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
      toast.error("Erro ao carregar solicitações.");
    } finally {
      setCarregando(false);
    }
  };

  const handleExcluirDados = async () => {
    if (!solicitacaoSelecionada) return;
    setExcluindo(true);
    try {
      // Chama a função RPC que apaga tudo em cascata (socios, ceps, empresa_usuarios, auth.users, empresas)
      const { error } = await supabase.rpc("deletar_empresa_completo", {
        p_empresa_id: solicitacaoSelecionada.empresa_id,
      });

      if (error) throw error;

      // Remove da lista local sem precisar recarregar
      setNomeExcluido(solicitacaoSelecionada.razao_social || solicitacaoSelecionada.email);
      setSolicitacoes((prev) => prev.filter((s) => s.id !== solicitacaoSelecionada.id));
      setSolicitacaoSelecionada(null);
      setExibirSucesso(true);
    } catch (err: any) {
      console.error("Erro ao excluir empresa:", err);
      toast.error("Erro ao excluir dados: " + (err.message || "Tente novamente."));
      setSolicitacaoSelecionada(null);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Solicitações de Exclusão</h1>
          <p className="text-gray-600 mt-1">Gerencie os pedidos de exclusão de dados baseados na LGPD.</p>
        </div>

        {carregando ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#7030A0]" />
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
            <p className="text-gray-500">Não há solicitações de exclusão no momento.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Data</th>
                  <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Empresa / Email</th>
                  <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Motivo</th>
                  <th className="p-4 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                  <th className="p-4 font-semibold text-gray-700 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitacoes.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(req.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{req.razao_social || 'Sem Razão Social'}</p>
                      <p className="text-sm text-gray-500">{req.email}</p>
                    </td>
                    <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={req.motivo || ''}>
                      {req.motivo || '-'}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {req.status === 'pendente' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <AlertCircle className="w-3 h-3" /> Pendente
                        </span>
                      ) : req.status === 'concluida' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3" /> Concluída
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Revertida
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {req.status === 'pendente' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSolicitacaoSelecionada(req)}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir Dados
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!solicitacaoSelecionada} onOpenChange={(open) => !open && setSolicitacaoSelecionada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Excluir Dados Permanentemente
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-700">
              Você está prestes a excluir <strong>permanentemente e de forma irreversível</strong> todos os dados da empresa:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="font-semibold text-red-800">{solicitacaoSelecionada?.razao_social || 'Sem Razão Social'}</p>
              <p className="text-sm text-red-600">{solicitacaoSelecionada?.email}</p>
            </div>
            <p className="text-sm text-gray-600">
              Isso irá remover: cadastro da empresa, sócios, CEPs, usuários vinculados e o acesso ao sistema. <strong>Esta ação não pode ser desfeita.</strong>
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSolicitacaoSelecionada(null)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExcluirDados}
              disabled={excluindo}
              className="bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
            >
              {excluindo ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Excluir Permanentemente</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de sucesso após exclusão */}
      <Dialog open={exibirSucesso} onOpenChange={setExibirSucesso}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Dados Excluídos com Sucesso
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Todos os dados de <strong>{nomeExcluido}</strong> foram removidos permanentemente do sistema, incluindo o acesso ao login.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setExibirSucesso(false)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </LayoutAdm>
  );
}

