import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Loader2, Trash2, CheckCircle2, Building, User, Phone, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { registrarLog } from "@/lib/registrarLog";
import { toast } from "sonner";

interface ModalNovaSolicitacaoAdmProps {
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
  onSucesso?: () => void;
}

export function ModalNovaSolicitacaoAdm({ aberto, onOpenChange, onSucesso }: ModalNovaSolicitacaoAdmProps) {
  const { usuario } = useAuth();
  
  // Dados de seleção
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [usuariosEmpresa, setUsuariosEmpresa] = useState<any[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(false);

  // Estados do formulário
  const [empresaId, setEmpresaId] = useState("");
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState("");
  
  const [solCnaes, setSolCnaes] = useState<string[]>(['']);
  const [solCidade, setSolCidade] = useState('');
  const [solModalidade, setSolModalidade] = useState<'online' | 'presencial' | 'ambos'>('ambos');
  const [solDescricao, setSolDescricao] = useState('');
  const [solArquivo, setSolArquivo] = useState<File | null>(null);
  
  const [solEnviando, setSolEnviando] = useState(false);
  const [solSucesso, setSolSucesso] = useState(false);
  const [solErro, setSolErro] = useState('');

  // Carregar empresas ao abrir o modal
  useEffect(() => {
    if (aberto) {
      carregarEmpresas();
      resetForm();
    }
  }, [aberto]);

  // Carregar usuários quando a empresa mudar
  useEffect(() => {
    if (empresaId) {
      carregarUsuariosEmpresa(empresaId);
    } else {
      setUsuariosEmpresa([]);
      setUsuarioSelecionadoId("");
    }
  }, [empresaId]);

  async function carregarEmpresas() {
    setCarregandoDados(true);
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, razao_social, cnpj, nome_responsavel, email, telefone_principal")
        .eq("status_aprovacao", "aprovado")
        .neq("tipo_usuario", "adm")
        .ilike("acesso_tipo", "%EMPRESA OU INICIATIVA INCENTIVADORA%")
        .order("razao_social", { ascending: true });
        
      if (error) throw error;
      setEmpresas(data || []);
    } catch (err) {
      console.error("Erro ao buscar empresas:", err);
      toast.error("Erro ao carregar lista de empresas.");
    } finally {
      setCarregandoDados(false);
    }
  }

  async function carregarUsuariosEmpresa(idEmpresa: string) {
    try {
      const { data, error } = await supabase
        .from("empresa_usuarios")
        .select("id, nome, email, auth_user_id, status")
        .eq("empresa_id", idEmpresa)
        .eq("status", "ativo");
        
      if (error) throw error;
      setUsuariosEmpresa(data || []);
      
      // Se houver apenas 1 usuário, seleciona automaticamente
      if (data && data.length === 1) {
        setUsuarioSelecionadoId(data[0].auth_user_id || "");
      } else {
        setUsuarioSelecionadoId("");
      }
    } catch (err) {
      console.error("Erro ao buscar usuários da empresa:", err);
    }
  }

  function resetForm() {
    setEmpresaId("");
    setUsuarioSelecionadoId("");
    setSolCnaes(['']);
    setSolCidade('');
    setSolModalidade('ambos');
    setSolDescricao('');
    setSolArquivo(null);
    setSolSucesso(false);
    setSolErro('');
  }

  function adicionarCnae() {
    if (solCnaes.length < 3) setSolCnaes((prev) => [...prev, '']);
  }

  function removerCnae(idx: number) {
    setSolCnaes((prev) => prev.filter((_, i) => i !== idx));
  }

  function atualizarCnae(idx: number, valor: string) {
    setSolCnaes((prev) => prev.map((v, i) => (i === idx ? valor : v)));
  }

  async function enviarSolicitacao() {
    setSolErro('');
    
    if (!empresaId) {
      setSolErro('Selecione a empresa.');
      return;
    }
    if (!usuarioSelecionadoId) {
      setSolErro('Selecione o usuário solicitante.');
      return;
    }

    const cnaesFiltrados = solCnaes.map((c) => c.trim()).filter(Boolean);
    
    if (solModalidade !== 'online' && !solCidade.trim()) {
      setSolErro('Informe a cidade onde o serviço será prestado.');
      return;
    }
    const cidadeFinal = solModalidade === 'online' ? 'Remoto (Online)' : solCidade.trim();
    
    setSolEnviando(true);
    try {
      let documentoUrl: string | null = null;

      if (solArquivo) {
        const ext = solArquivo.name.split('.').pop();
        const nomeArquivo = `${empresaId}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('solicitacoes-busca')
          .upload(nomeArquivo, solArquivo, { upsert: false });
        if (uploadErr) throw new Error('Erro ao enviar o arquivo: ' + uploadErr.message);
        const { data: urlData } = supabase.storage
          .from('solicitacoes-busca')
          .getPublicUrl(nomeArquivo);
        documentoUrl = urlData?.publicUrl ?? null;
      }

      // Inserir no banco
      const { error: insertErr } = await supabase.from('solicitacoes_busca').insert({
        empresa_id: empresaId,
        usuario_id: usuarioSelecionadoId,
        cnaes: cnaesFiltrados,
        cidade: cidadeFinal,
        modalidade: solModalidade,
        descricao: solDescricao.trim() || null,
        documento_url: documentoUrl,
      });
      if (insertErr) throw new Error(insertErr.message);

      setSolSucesso(true);
      if (onSucesso) onSucesso();

      registrarLog({
        tipo_evento: 'solicitacao_busca_empreendedores',
        email: usuario?.email, // o email de quem executou a ação (admin)
        empresa_id: empresaId,
        detalhes: `CRIADO POR ADM | CNAEs: ${cnaesFiltrados.length > 0 ? cnaesFiltrados.join(', ') : 'Nenhum'} | Cidade: ${cidadeFinal}`,
      });

      // Dispara o e-mail de notificação para a tecnologia
      fetch('/api/enviar-email-nova-solicitacao-busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: empresaId,
          cnaes: cnaesFiltrados.length > 0 ? cnaesFiltrados : ["Não informado"],
          cidade: cidadeFinal,
          modalidade: solModalidade,
          descricao: solDescricao.trim() || null
        })
      }).catch((err) => {
        console.error("Erro ao notificar tecnologia:", err);
      });

    } catch (err: any) {
      setSolErro(err.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setSolEnviando(false);
    }
  }

  function handleFechar() {
    onOpenChange(false);
  }

  const empresaSelecionada = empresas.find(e => e.id === empresaId);
  const usuarioSelecionadoObj = usuariosEmpresa.find(u => u.auth_user_id === usuarioSelecionadoId);

  return (
    <Dialog open={aberto} onOpenChange={(open) => {
      if(!open) handleFechar();
      else onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Send className="w-5 h-5 text-[#7030A0]" />
            Criar Solicitação de Busca (Admin)
          </DialogTitle>
        </DialogHeader>

        {solSucesso ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold text-gray-900 text-center">
              Solicitação criada com sucesso!
            </p>
            <Button
              onClick={handleFechar}
              className="bg-[#7030A0] hover:bg-purple-800 text-white mt-2"
            >
              Concluir
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            
            {/* Bloco 1: Seleção de Empresa e Usuário */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Building className="w-4 h-4" /> 1. Empresa Solicitante
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Empresa</label>
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                    disabled={carregandoDados}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="">Selecione uma empresa...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.razao_social} {emp.cnpj ? `(${emp.cnpj})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {empresaId && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Usuário Solicitante</label>
                    <select
                      value={usuarioSelecionadoId}
                      onChange={(e) => setUsuarioSelecionadoId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    >
                      <option value="">Selecione o usuário...</option>
                      {usuariosEmpresa.map(usu => (
                        <option key={usu.id} value={usu.auth_user_id || ""}>
                          {usu.nome} ({usu.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {empresaId && usuarioSelecionadoObj && (
                <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm text-sm">
                  <p className="font-semibold text-gray-800 flex items-center gap-1.5 mb-1">
                    <User className="w-4 h-4 text-gray-500" /> {usuarioSelecionadoObj.nome}
                  </p>
                  <div className="text-gray-500 text-xs space-y-1 ml-5">
                    <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {usuarioSelecionadoObj.email}</p>
                    {empresaSelecionada?.telefone_principal && (
                      <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Contato base da empresa: {empresaSelecionada.telefone_principal}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 2: Dados da Solicitação */}
            <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-4">
               <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Send className="w-4 h-4" /> 2. Dados da Solicitação
              </h3>

              {/* CNAEs */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  CNAEs desejados <span className="font-normal text-gray-400">(opcional, até 3)</span>
                </p>
                <div className="space-y-2 mt-2">
                  {solCnaes.map((cnae, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder={`CNAE ${idx + 1} — ex: 6201-5/00`}
                        value={cnae}
                        onChange={(e) => atualizarCnae(idx, e.target.value)}
                        className="flex-1 h-10 bg-white"
                      />
                      {solCnaes.length > 1 && (
                        <button
                          onClick={() => removerCnae(idx)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remover CNAE"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {solCnaes.length < 3 && (
                    <button
                      onClick={adicionarCnae}
                      className="text-sm font-medium text-[#7030A0] hover:text-purple-800 transition-colors inline-flex items-center gap-1 mt-1"
                    >
                      + Adicionar outro CNAE
                    </button>
                  )}
                </div>
              </div>

              {/* Modalidade */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Modalidade do serviço</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { val: 'online', label: '🌐 Online' },
                    { val: 'presencial', label: '📍 Presencial' },
                    { val: 'ambos', label: '✅ Ambos' }
                  ] as const).map(op => (
                    <button
                      key={op.val}
                      onClick={() => setSolModalidade(op.val)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        solModalidade === op.val
                          ? 'bg-[#7030A0] text-white border-[#7030A0]'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cidade */}
              {solModalidade !== 'online' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade onde o serviço será prestado</label>
                  <Input
                    placeholder="Ex: São Paulo, SP"
                    value={solCidade}
                    onChange={(e) => setSolCidade(e.target.value)}
                    className="h-10 bg-white"
                  />
                </div>
              )}

              {/* Documento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Documento <span className="font-normal text-gray-400">(opcional)</span></label>
                <p className="text-xs text-gray-500 mb-2">Anexe um briefing, edital ou documento relevante (PDF, DOC, imagem).</p>
                <Input
                  type="file"
                  onChange={(e) => setSolArquivo(e.target.files?.[0] || null)}
                  className="bg-white file:text-[#7030A0] file:font-semibold file:bg-purple-50 file:px-3 file:py-1 file:rounded-md file:border-0 cursor-pointer"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Detalhes da solicitação <span className="font-normal text-gray-400">(opcional)</span></label>
                <Textarea
                  placeholder="Informações adicionais importantes..."
                  value={solDescricao}
                  onChange={(e) => setSolDescricao(e.target.value)}
                  className="min-h-[100px] bg-white resize-y"
                />
              </div>
            </div>

            {solErro && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex items-start gap-2">
                <span className="font-semibold text-red-700 mt-0.5">X</span>
                <span>{solErro}</span>
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={enviarSolicitacao}
                disabled={solEnviando || !empresaId || !usuarioSelecionadoId}
                className="w-full h-11 bg-[#7030A0] hover:bg-purple-800 text-white font-semibold text-base transition-colors"
              >
                {solEnviando ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Criando Solicitação...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Criar Solicitação
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
