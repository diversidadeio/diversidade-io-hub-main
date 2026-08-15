import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { registrarLog } from "@/lib/registrarLog";

export default function TrocarSenha() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [isCarregando, setIsCarregando] = useState(false);
  // Quando true, o token de recuperação do link do e-mail está sendo processado
  const [processandoToken, setProcessandoToken] = useState(true);
  // Quando true, o token foi validado e o usuário pode definir a senha
  const [tokenValido, setTokenValido] = useState(false);
  
  const { usuario, atualizarSessao } = useAuth();
  const [, navigate] = useLocation();

  // Captura o token de recuperação que o Supabase coloca no hash da URL
  // após o usuário clicar no link do e-mail de convite.
  // Ex: /trocar-senha#access_token=xxx&type=recovery
  useEffect(() => {
    async function processarTokenRecuperacao() {
      const hash = window.location.hash;
      
      if (hash && hash.includes("type=recovery")) {
        // O Supabase SDK já processa o hash automaticamente ao detectar type=recovery
        // Aguardamos a sessão ser estabelecida
        const { data, error } = await supabase.auth.getSession();
        
        if (data?.session && !error) {
          setTokenValido(true);
        } else {
          // Tenta trocar o token explicitamente pelo hash
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!sessionError) {
              setTokenValido(true);
            } else {
              setErro("Link de recuperação inválido ou expirado. Solicite um novo convite.");
            }
          } else {
            setErro("Link de recuperação inválido. Solicite um novo convite.");
          }
        }
        // Remove o hash da URL para não expor o token
        window.history.replaceState(null, "", window.location.pathname);
      } else if (usuario) {
        // Usuário já autenticado normalmente (ex: senha temporária)
        setTokenValido(true);
      } else {
        setErro("Acesse esta página pelo link enviado no e-mail de convite.");
      }
      
      setProcessandoToken(false);
    }
    
    processarTokenRecuperacao();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não conferem.");
      return;
    }

    setIsCarregando(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: senha
      });

      if (error) throw error;

      // Obtém a sessão atual (usuário convidado vem do fluxo de recovery)
      const { data: sessaoAtual } = await supabase.auth.getSession();
      const authUserId = sessaoAtual?.session?.user?.id;
      const emailAtual = usuario?.email || sessaoAtual?.session?.user?.email;

      // Ativa o usuário convidado: atualiza status de 'pendente' para 'ativo'
      // Isso é necessário para que o login funcione após a definição da senha
      if (authUserId) {
        await supabase
          .from('empresa_usuarios')
          .update({ status: 'ativo' })
          .eq('auth_user_id', authUserId)
          .eq('status', 'pendente');
      }

      // Limpa a flag de senha_temporaria no banco de dados usando a RPC existente
      if (usuario?.empresaId) {
        await supabase.rpc('redefinir_senha', { 
          p_empresa_id: usuario.empresaId, 
          p_nova_senha_hash: 'migrated_to_auth' 
        });
      }

      // Registra log de troca de senha
      registrarLog({
        tipo_evento: 'troca_senha',
        email: emailAtual,
        empresa_id: usuario?.empresaId,
      });

      // Sai da sessão temporária de recuperação para forçar um novo login completo
      await supabase.auth.signOut();
      
      // Redireciona para o login do app (não a home do marketing)
      window.location.href = "/login";


      
    } catch (err: any) {
      console.error(err);
      setErro("Ocorreu um erro ao redefinir a senha: " + err.message);
      setIsCarregando(false);
    }
  };

  // Removemos a verificação estrita de usuario.senhaTemporaria porque no fluxo de
  // recuperação por e-mail do Supabase Auth, a pessoa já cai aqui autenticada
  // temporariamente pelo token do link.

  // Estado: processando o token do link de e-mail
  if (processandoToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
          <p className="text-sm">Verificando seu link de acesso...</p>
        </div>
      </div>
    );
  }

  // Estado: token inválido ou ausente
  if (!tokenValido) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-8 space-y-6 text-center">
            <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-red-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Link inválido</h1>
            <p className="text-gray-600 text-sm">{erro || "Este link de acesso é inválido ou já expirou."}</p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full h-12 text-white font-semibold text-base rounded-xl mt-4"
              style={{ backgroundColor: "#7030A0" }}
            >
              Ir para o Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-amber-600">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Defina sua Senha</h1>
            <p className="text-gray-600 text-sm">
              Crie uma senha segura para acessar a plataforma Diversidade.io.
            </p>
          </div>

          {erro && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova Senha</Label>
              <Input
                id="nova-senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="h-12"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Digite a senha novamente"
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={isCarregando}
              className="w-full h-12 text-white font-semibold text-base rounded-xl shadow-md transition-all mt-4"
              style={{ backgroundColor: "#7030A0" }}
            >
              {isCarregando ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                "Definir Senha e Acessar"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
