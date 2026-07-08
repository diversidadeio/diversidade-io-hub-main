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

      // Sai da sessão atual do Supabase para forçar um novo login completo pelo AuthContext
      await supabase.auth.signOut();
      
      // Redireciona para o login
      navigate("/");

      
    } catch (err: any) {
      console.error(err);
      setErro("Ocorreu um erro ao redefinir a senha: " + err.message);
      setIsCarregando(false);
    }
  };

  // Removemos a verificação estrita de usuario.senhaTemporaria porque no fluxo de
  // recuperação por e-mail do Supabase Auth, a pessoa já cai aqui autenticada
  // temporariamente pelo token do link.

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
