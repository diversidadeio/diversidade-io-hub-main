import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function TrocarSenha() {
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [isCarregando, setIsCarregando] = useState(false);
  
  const { usuario, atualizarSessao } = useAuth();
  const [, navigate] = useLocation();

  // Função auxiliar de hash
  const hashPassword = async (password: string) => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

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
      if (!usuario) throw new Error("Usuário não encontrado na sessão.");

      const senhaHasheada = await hashPassword(senha);

      const { error } = await supabase.rpc('redefinir_senha', {
        p_empresa_id: usuario.empresaId,
        p_nova_senha_hash: senhaHasheada
      });

      if (error) throw error;

      // Atualiza a sessão e vai para o fluxo normal
      atualizarSessao({ senhaTemporaria: false });
      
      // O App.tsx ou o AuthContext cuidará do roteamento na próxima renderização,
      // mas podemos forçar o redirecionamento aqui.
      navigate(usuario.tipoUsuario === 'adm' ? "/adm" : "/meu-cadastro");
      
    } catch (err: any) {
      console.error(err);
      setErro("Ocorreu um erro ao redefinir a senha: " + err.message);
      setIsCarregando(false);
    }
  };

  // Proteção: só deve estar aqui se senhaTemporaria for true
  if (!usuario || !usuario.senhaTemporaria) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-amber-600">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Atualização Obrigatória</h1>
            <p className="text-gray-600 text-sm">
              Sua senha foi redefinida por um administrador. Por motivos de segurança, você precisa criar uma nova senha para continuar.
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
              {isCarregando ? "Salvando..." : "Redefinir Senha e Acessar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
