import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { Loader2, Camera, User, Lock, Phone, ChevronRight, ArrowLeft, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ModalConfiguracoesPerfilProps {
  aberto: boolean;
  aoFechar: () => void;
}

// Tela que fica visível: 'conta' ou 'senha'
type Tela = 'conta' | 'senha';

export function ModalConfiguracoesPerfil({ aberto, aoFechar }: ModalConfiguracoesPerfilProps) {
  const { usuario, atualizarSessao } = useAuth();
  const [telaAtiva, setTelaAtiva] = useState<Tela>('conta');

  // --- Dados de conta ---
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // --- Dados de senha ---
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // Reseta ao fechar
  useEffect(() => {
    if (!aberto) {
      setTelaAtiva('conta');
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    }
  }, [aberto]);

  // Carrega dados do perfil ao abrir
  useEffect(() => {
    if (!aberto) return;

    async function carregarDados() {
      setCarregando(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error("Usuário não autenticado");
        setAuthUserId(session.user.id);

        const { data, error } = await supabase
          .from('empresa_usuarios')
          .select('nome, telefone, foto_url')
          .eq('auth_user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // Não joga erro: usa fallback da sessão
          console.warn("empresa_usuarios não encontrado, usando dados da sessão.");
        }

        if (data) {
          // Se o nome ainda não foi definido no perfil, usa o nome do responsável da sessão
          setNome(data.nome || usuario?.nomeResponsavel || "");
          setTelefone(data.telefone || "");
          setFotoUrl(data.foto_url || null);
        } else {
          // Sem registro em empresa_usuarios ainda, carrega da sessão
          setNome(usuario?.nomeResponsavel || "");
        }
      } catch (err: any) {
        // Em qualquer erro, apenas pré-preenche com dados da sessão sem mostrar mensagem de erro
        console.warn("Erro ao carregar perfil, usando dados da sessão:", err);
        setNome(usuario?.nomeResponsavel || "");
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [aberto]);

  // Upload de foto
  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    // 1. Mostra preview local IMEDIATAMENTE (sem esperar o upload terminar)
    const previewLocal = URL.createObjectURL(file);
    setFotoUrl(previewLocal);

    if (!authUserId) {
      toast.info("Foto selecionada! Clique em Salvar para confirmar.");
      return;
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `usuarios/${authUserId}/${crypto.randomUUID()}.${fileExt}`;

    try {
      setSalvandoConta(true);

      // 2. Faz o upload no storage
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Erro no storage upload:", uploadError);
        toast.error(`Erro no upload: ${uploadError.message}`);
        return;
      }

      // 3. Obtém a URL pública definitiva
      const { data: publicUrlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath);

      const novaUrl = publicUrlData.publicUrl;
      setFotoUrl(novaUrl);

      // 4. Salva no banco
      const { error: updateError } = await supabase
        .from('empresa_usuarios')
        .update({ foto_url: novaUrl })
        .eq('auth_user_id', authUserId);

      if (updateError) {
        console.error("Erro ao salvar foto no banco:", updateError);
        toast.error(`Erro ao salvar: ${updateError.message}`);
      } else {
        toast.success("Foto atualizada com sucesso!");
        atualizarSessao({ fotoUrl: novaUrl });
      }
    } catch (err: any) {
      console.error("Erro inesperado:", err);
      toast.error(err.message || "Erro inesperado ao enviar a foto.");
    } finally {
      setSalvandoConta(false);
    }
  };

  // Salvar dados da conta
  const handleSalvarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConta(true);

    try {
      // Garante que temos o ID do usuário autenticado (busca novamente se necessário)
      let uid = authUserId;
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id ?? null;
        if (uid) setAuthUserId(uid);
      }

      if (!uid) {
        toast.error("Sessão expirada. Por favor, faça login novamente.");
        return;
      }

      // Atualiza o registro existente
      const { error } = await supabase
        .from('empresa_usuarios')
        .update({ nome, telefone, foto_url: fotoUrl })
        .eq('auth_user_id', uid);

      if (error) throw error;

      toast.success("Informações atualizadas com sucesso!");
      atualizarSessao({ nome, fotoUrl });
      aoFechar();
    } catch (err: any) {
      console.error("Erro ao salvar conta:", err);
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSalvandoConta(false);
    }
  };

  // Salvar nova senha
  const handleSalvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não conferem.");
      return;
    }

    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setTelaAtiva('conta');
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar a senha.");
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(val) => !val && aoFechar()}>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">

        {/* ===================== TELA: INFORMAÇÕES DA CONTA ===================== */}
        {telaAtiva === 'conta' && (
          <>
            {/* Cabeçalho */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
                  Configurações
                </DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400 text-sm">
                  Gerencie suas informações pessoais de acesso.
                </DialogDescription>
              </DialogHeader>
            </div>

            {carregando ? (
              <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-7 h-7 animate-spin text-[#7030A0]" />
                <p className="text-sm text-gray-500 mt-3">Carregando...</p>
              </div>
            ) : (
              <form onSubmit={handleSalvarConta}>
                <div className="p-6 space-y-6">

                  {/* Seção: Informações da Conta */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                      Informações da Conta
                    </p>

                    {/* Foto */}
                    <div className="flex items-center gap-4 mb-5">
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
                          {fotoUrl ? (
                            <img src={fotoUrl} alt="Perfil" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-7 h-7 text-gray-400" />
                          )}
                        </div>
                        <label
                          htmlFor="upload-foto"
                          className="absolute -bottom-1 -right-1 p-1.5 bg-[#7030A0] hover:bg-purple-800 transition-colors text-white rounded-full cursor-pointer shadow"
                        >
                          {salvandoConta ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Camera className="w-3 h-3" />
                          )}
                        </label>
                        <input
                          type="file"
                          id="upload-foto"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadFoto}
                          disabled={salvandoConta}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Foto de perfil</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Clique no ícone da câmera para alterar</p>
                      </div>
                    </div>

                    {/* Nome */}
                    <div className="space-y-1.5 mb-4">
                      <Label htmlFor="nome" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nome de usuário
                      </Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Seu nome completo"
                        className="h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                        required
                      />
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1.5">
                      <Label htmlFor="telefone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Telefone <span className="text-gray-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="telefone"
                        value={telefone}
                        onChange={e => setTelefone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Seção: Senha e Segurança — card clicável */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                      Segurança
                    </p>
                    <button
                      type="button"
                      onClick={() => setTelaAtiva('senha')}
                      className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-[#7030A0] dark:text-purple-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Senha e Segurança</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Altere sua senha de acesso</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#7030A0] dark:group-hover:text-purple-400 transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Rodapé */}
                <div className="px-6 pb-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <Button type="button" variant="outline" onClick={aoFechar} disabled={salvandoConta}
                    className="dark:border-gray-700 dark:text-gray-300">
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={salvandoConta}
                    style={{ backgroundColor: "#7030A0" }}
                    className="text-white px-6 min-w-[120px]"
                  >
                    {salvandoConta ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}

        {/* ===================== TELA: SENHA E SEGURANÇA ===================== */}
        {telaAtiva === 'senha' && (
          <>
            {/* Cabeçalho com botão voltar */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setTelaAtiva('conta')}
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#7030A0] dark:hover:text-purple-400 transition-colors mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Configurações
              </button>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#7030A0] dark:text-purple-400" />
                  Senha e Segurança
                </DialogTitle>
                <DialogDescription className="text-gray-500 dark:text-gray-400 text-sm">
                  Crie uma nova senha segura para sua conta.
                </DialogDescription>
              </DialogHeader>
            </div>

            <form onSubmit={handleSalvarSenha}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="novaSenha" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nova senha
                  </Label>
                  <Input
                    id="novaSenha"
                    type="password"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmarSenha" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirmarSenha"
                    type="password"
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="h-11 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    required
                  />
                </div>

                {/* Dica de segurança */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Use pelo menos 8 caracteres com letras maiúsculas, minúsculas e números para uma senha mais segura.
                  </p>
                </div>
              </div>

              {/* Rodapé */}
              <div className="px-6 pb-6 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setTelaAtiva('conta')} disabled={salvandoSenha}
                  className="dark:border-gray-700 dark:text-gray-300">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoSenha}
                  style={{ backgroundColor: "#7030A0" }}
                  className="text-white px-6 min-w-[150px]"
                >
                  {salvandoSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : "Alterar Senha"}
                </Button>
              </div>
            </form>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
