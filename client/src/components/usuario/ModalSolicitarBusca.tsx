import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Loader2, Plus, Trash2, FileUp, X, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { registrarLog } from "@/lib/registrarLog";

interface ModalSolicitarBuscaProps {
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
  onSucesso?: () => void;
}

export function ModalSolicitarBusca({ aberto, onOpenChange, onSucesso }: ModalSolicitarBuscaProps) {
  const { usuario } = useAuth();
  
  const [solCnaes, setSolCnaes] = useState<string[]>(['']);
  const [solCidade, setSolCidade] = useState('');
  const [solModalidade, setSolModalidade] = useState<'online' | 'presencial' | 'ambos'>('ambos');
  const [solDescricao, setSolDescricao] = useState('');
  const [solArquivo, setSolArquivo] = useState<File | null>(null);
  const [solEnviando, setSolEnviando] = useState(false);
  const [solSucesso, setSolSucesso] = useState(false);
  const [solErro, setSolErro] = useState('');
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // Reseta estado quando o modal abre
  if (aberto && solSucesso === false && solCnaes.length === 1 && solCnaes[0] === '' && solCidade === '' && solModalidade === 'ambos' && solDescricao === '' && solArquivo === null && solErro === '') {
    // Estado já está limpo
  } else if (!aberto && solSucesso) {
     // Reseta quando fecha
     setTimeout(() => {
        setSolCnaes(['']);
        setSolCidade('');
        setSolModalidade('ambos');
        setSolDescricao('');
        setSolArquivo(null);
        setSolSucesso(false);
        setSolErro('');
     }, 300);
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

  function handleSolArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0] ?? null;
    setSolArquivo(arquivo);
  }

  async function enviarSolicitacao() {
    setSolErro('');
    const cnaesFiltrados = solCnaes.map((c) => c.trim()).filter(Boolean);
    
    if (solModalidade !== 'online' && !solCidade.trim()) {
      setSolErro('Informe a cidade onde o serviço será prestado.');
      return;
    }
    const cidadeFinal = solModalidade === 'online' ? 'Remoto (Online)' : solCidade.trim();
    setSolEnviando(true);
    try {
      let documentoUrl: string | null = null;

      // Upload do arquivo (se houver)
      if (solArquivo) {
        const ext = solArquivo.name.split('.').pop();
        const nomeArquivo = `${(usuario as any).empresaId}_${Date.now()}.${ext}`;
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
        empresa_id: (usuario as any).empresaId,
        usuario_id: usuario?.id,
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
        email: usuario?.email,
        empresa_id: (usuario as any)?.empresaId,
        detalhes: `CNAEs: ${cnaesFiltrados.length > 0 ? cnaesFiltrados.join(', ') : 'Nenhum'} | Cidade: ${cidadeFinal} | Modalidade: ${solModalidade}`,
      });

      // Dispara o e-mail de notificação para os administradores em background
      fetch('/api/enviar-email-nova-solicitacao-busca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: (usuario as any).empresaId,
          cnaes: cnaesFiltrados.length > 0 ? cnaesFiltrados : ["Não informado"],
          cidade: cidadeFinal,
          modalidade: solModalidade,
          descricao: solDescricao.trim() || null
        })
      }).catch((err) => {
        console.error("Erro ao enviar e-mail de notificação para administradores:", err);
      });

    } catch (err: any) {
      setSolErro(err.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setSolEnviando(false);
    }
  }

  function handleFechar() {
      onOpenChange(false);
      // O reset do estado acontece no useEffect ou render condition acima
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => {
        if(!open) handleFechar();
        else onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Send className="w-5 h-5 text-[#7030A0] dark:text-purple-400" />
            Solicitar Busca de Empreendedores
          </DialogTitle>
        </DialogHeader>

        {/* Tela de sucesso */}
        {solSucesso ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold text-gray-900 dark:text-white text-center">
              Solicitação enviada com sucesso!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Nossa equipe irá analisar e retornar com os empreendedores encontrados.
            </p>
            <Button
              onClick={handleFechar}
              className="bg-[#7030A0] hover:bg-purple-800 text-white mt-2"
            >
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* CNAEs */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                CNAEs desejados <span className="font-normal text-gray-400">(opcional, até 3)</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Informe o código CNAE ou a descrição da atividade que você busca.
              </p>
              <div className="space-y-2">
                {solCnaes.map((cnae, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder={`CNAE ${idx + 1} — ex: 6201-5/00`}
                      value={cnae}
                      onChange={(e) => atualizarCnae(idx, e.target.value)}
                      className="flex-1 h-10 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    />
                    {solCnaes.length > 1 && (
                      <button
                        onClick={() => removerCnae(idx)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Remover CNAE"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {solCnaes.length < 3 && (
                <button
                  onClick={adicionarCnae}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#7030A0] dark:text-purple-400 hover:underline font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar outro CNAE
                </button>
              )}
            </div>

            <Separator className="dark:border-gray-700" />

            {/* Modalidade */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Modalidade do serviço
              </p>
              <div className="flex gap-3 flex-wrap">
                {(
                  [
                    { value: 'online', label: '🌐 Online' },
                    { value: 'presencial', label: '📍 Presencial' },
                    { value: 'ambos', label: '✅ Ambos' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setSolModalidade(value);
                      if (value === 'online') setSolCidade('');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      solModalidade === value
                        ? 'bg-[#7030A0] text-white border-[#7030A0]'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {solModalidade !== 'online' && (
              <>
                <Separator className="dark:border-gray-700" />

                {/* Cidade */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                    Cidade onde o serviço será prestado
                  </Label>
                  <Input
                    placeholder="Ex: São Paulo, SP"
                    value={solCidade}
                    onChange={(e) => setSolCidade(e.target.value)}
                    className="h-10 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}

            <Separator className="dark:border-gray-700" />

            {/* Upload de documento */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Documento <span className="font-normal text-gray-400">(opcional)</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Anexe um briefing, edital ou qualquer documento relevante (PDF, DOC, imagem).
              </p>
              <div
                onClick={() => inputArquivoRef.current?.click()}
                className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 hover:border-[#7030A0] dark:hover:border-purple-500 transition-colors"
              >
                <FileUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {solArquivo ? solArquivo.name : 'Clique para selecionar um arquivo'}
                </span>
                {solArquivo && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSolArquivo(null); if (inputArquivoRef.current) inputArquivoRef.current.value = ''; }}
                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                ref={inputArquivoRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleSolArquivo}
              />
            </div>

            <Separator className="dark:border-gray-700" />

            {/* Descrição */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Detalhes da solicitação <span className="font-normal text-gray-400">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Descreva o que você precisa, o contexto do projeto, prazo ou qualquer informação relevante para encontrar o empreendedor ideal..."
                value={solDescricao}
                onChange={(e) => setSolDescricao(e.target.value)}
                rows={4}
                className="resize-none dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </div>

            {/* Mensagem de erro */}
            {solErro && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{solErro}</p>
              </div>
            )}
          </div>
        )}

        {!solSucesso && (
          <DialogFooter className="flex flex-row justify-between gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleFechar}
              disabled={solEnviando}
              className="flex-1 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={enviarSolicitacao}
              disabled={solEnviando}
              className="flex-1 bg-[#7030A0] hover:bg-purple-800 text-white"
            >
              {solEnviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Solicitação
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
