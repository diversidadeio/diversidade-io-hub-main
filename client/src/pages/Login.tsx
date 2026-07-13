import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoImage from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * Página de Login — tela simples e limpa para acesso ao painel do cadastro.
 * Design alinhado com a identidade visual da Diversidade.io.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [isCarregando, setIsCarregando] = useState(false);
  const [mostrarModalRecuperacao, setMostrarModalRecuperacao] = useState(false);
  const [esqueciSenhaAberto, setEsqueciSenhaAberto] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [isRecuperando, setIsRecuperando] = useState(false);
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState<{ tipo: "sucesso" | "erro", texto: string } | null>(null);
  
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const handleRecuperarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperacao) return;

    setIsRecuperando(true);
    setMensagemRecuperacao(null);

    try {
      const res = await fetch("/api/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRecuperacao }),
      });

      const textData = await res.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch (parseError) {
        console.error("Resposta do servidor não é JSON:", textData);
        throw new Error(`Erro inesperado do servidor (Status ${res.status}). Resposta: ${textData.substring(0, 50)}...`);
      }

      if (!res.ok) {
        throw new Error(data?.erro || "Erro ao solicitar recuperação de senha.");
      }

      setMensagemRecuperacao({
        tipo: "sucesso",
        texto: "Link de redefinição de senha enviado! Verifique sua caixa de entrada (e a pasta de spam).",
      });
      setEmailRecuperacao("");
    } catch (err: any) {
      setMensagemRecuperacao({
        tipo: "erro",
        texto: err.message || "Ocorreu um erro ao tentar recuperar a senha.",
      });
    } finally {
      setIsRecuperando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setIsCarregando(true);

    const resultado = await login(email, senha);

    if (resultado.sucesso) {
      if (resultado.senhaTemporaria) {
        navigate("/trocar-senha");
      } else if (resultado.tipoUsuario === 'adm') {
        navigate("/adm");
      } else {
        navigate("/meu-cadastro");
      }
    } else {
      setErro(resultado.erro ?? "Erro ao realizar login.");
      setIsCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3E8FF] via-white to-[#EFF6FF] flex flex-col items-center justify-center px-4">
      {/* Card de Login */}
      <div className="w-full max-w-md">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-12 w-auto object-contain" />
            <span className="font-bold text-2xl" style={{ color: "#7030A0" }}>
              Diversidade.io
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo de volta</h1>
          <p className="text-gray-500 text-sm">
            Acesse sua conta para visualizar e atualizar seu cadastro
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
          {/* Barra superior decorativa */}
          <div
            className="h-1.5 w-full"
            style={{ background: "linear-gradient(to right, #7030A0, #0F3A7D)" }}
          />

          <div className="p-8">
            {/* Mensagem de Erro */}
            {erro && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Campo E-mail */}
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-gray-700 font-medium text-sm">
                  E-mail
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all"
                  autoComplete="email"
                />
              </div>

              {/* Campo Senha */}
              <div className="space-y-2">
                <Label htmlFor="login-senha" className="text-gray-700 font-medium text-sm">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="login-senha"
                    type={mostrarSenha ? "text" : "password"}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => setMostrarModalRecuperacao(true)}
                    className="text-xs text-purple-700 hover:text-purple-900 font-medium transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>

              {/* Botão Entrar */}
              <Button
                type="submit"
                disabled={isCarregando}
                className="w-full h-12 text-white font-semibold text-base rounded-xl shadow-md hover:shadow-lg hover:opacity-90 active:scale-[0.98] transition-all mt-2"
                style={{ backgroundColor: "#7030A0" }}
              >
                {isCarregando ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-5 h-5" />
                    Entrar
                  </span>
                )}
              </Button>
            </form>

            {/* Divisor */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">ou</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Link Cadastre-se */}
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-3">Ainda não tem cadastro?</p>
              <Button
                asChild
                variant="outline"
                className="w-full h-11 border-2 font-semibold rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
                style={{ borderColor: "#7030A0", color: "#7030A0" }}
              >
                <Link href="/cadastro-gratuito">
                  Cadastre-se
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Link voltar */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-purple-700 transition-colors inline-flex items-center gap-1"
          >
            ← Voltar para a página inicial
          </Link>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      <Dialog open={mostrarModalRecuperacao} onOpenChange={setMostrarModalRecuperacao}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900" style={{ color: "#7030A0" }}>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu e-mail abaixo e enviaremos um link para você redefinir sua senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecuperarSenha} className="space-y-4 mt-4">
            {mensagemRecuperacao && (
              <div className={`p-3 rounded-lg text-sm ${mensagemRecuperacao.tipo === "sucesso" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {mensagemRecuperacao.texto}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email-recuperacao">E-mail</Label>
              <Input
                id="email-recuperacao"
                type="email"
                placeholder="seu@email.com"
                value={emailRecuperacao}
                onChange={(e) => setEmailRecuperacao(e.target.value)}
                required
                className="h-11"
              />
            </div>
            
            <Button
              type="submit"
              disabled={isRecuperando || !emailRecuperacao}
              className="w-full h-11 text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#7030A0" }}
            >
              {isRecuperando ? "Enviando..." : "Enviar link de redefinição"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>


    </div>
  );
}
