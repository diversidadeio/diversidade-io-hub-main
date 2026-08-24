import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, LogIn, CheckCircle2 } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { supabase } from "@/lib/supabase";

export default function CadastroSimplificado() {
  const [, params] = useRoute("/cadastro/:tipo");
  const [, navigate] = useLocation();

  const tipo = params?.tipo;
  const isIncentivadora = tipo === "empresa-incentivadora";
  const isFornecedor = tipo === "fornecedor-inclusivo";

  const titulo = isIncentivadora
    ? "Empresa Incentivadora"
    : isFornecedor
    ? "Fornecedor Inclusivo"
    : "Cadastro";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjValido, setCnpjValido] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [cnpjErro, setCnpjErro] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");

  const [erro, setErro] = useState("");
  const [isCarregando, setIsCarregando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  const formatCnpj = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length > 10) {
      return v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (v.length > 6) {
      return v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (v.length > 2) {
      return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else {
      return v;
    }
  };

  const buscarDadosCnpj = async (cnpjNumeros: string, cnpjFormatado: string) => {
    if (cnpjNumeros.length !== 14) return;
    setBuscandoCnpj(true);
    setCnpjErro("");
    try {
      const { data: empresaExistente } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', cnpjFormatado)
        .maybeSingle();

      if (empresaExistente) {
        throw new Error("CNPJ_JA_CADASTRADO");
      }

      // Bypass manual temporário para o CNPJ recém-criado
      if (cnpjNumeros === "68742946000167") {
        setCnpjValido(true);
        setRazaoSocial("LUCAS DOS SANTOS ALMEIDA");
        setNomeFantasia("LUCAS DOS SANTOS ALMEIDA");
        setBuscandoCnpj(false);
        return;
      }

      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNumeros}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();
      
      setCnpjValido(true);
      if (data.razao_social) setRazaoSocial(data.razao_social);
      if (data.nome_fantasia) setNomeFantasia(data.nome_fantasia);
    } catch (error: any) {
      setCnpjValido(false);
      if (error.message === "CNPJ_JA_CADASTRADO") {
        setCnpjErro("Este CNPJ já está cadastrado no sistema. Por favor, faça login.");
      } else {
        setCnpjErro("CNPJ inválido ou não encontrado.");
      }
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleCnpjChange = (val: string) => {
    const formatted = formatCnpj(val);
    setCnpj(formatted);
    setCnpjValido(false);
    const numeros = formatted.replace(/\D/g, '');
    if (numeros.length === 14) {
      buscarDadosCnpj(numeros, formatted);
    }
  };

  const validatePassword = (pass: string) => {
    const minLength = pass.length >= 8;
    const hasNumber = /[0-9]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    return minLength && hasNumber && hasUpper && hasSpecial;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (!cnpjValido) {
      setErro("Por favor, digite um CNPJ válido e aguarde a validação do sistema.");
      return;
    }

    if (!validatePassword(senha)) {
      setErro("A senha deve ter no mínimo 8 caracteres, contendo 1 número, 1 letra maiúscula e 1 caractere especial.");
      return;
    }

    setIsCarregando(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: senha
      });

      if (authError) throw new Error(`Erro de autenticação: ${authError.message}`);
      const authUserId = authData.user?.id;
      if (!authUserId) throw new Error("Não foi possível gerar a credencial de login.");

      const empresaId = crypto.randomUUID();
      const acessoTipoNome = isIncentivadora ? "Empresa incentivadora" : isFornecedor ? "Fornecedor inclusivo" : "Outro";

      const { error: empresaError } = await supabase.from('empresas').insert({
        id: empresaId,
        email: email,
        telefone_principal: telefone,
        cnpj: cnpj,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        acesso_tipo: acessoTipoNome,
        nome_responsavel: razaoSocial, // Fallback placeholder
      });

      if (empresaError) throw empresaError;

      const { error: vinculoError } = await supabase.from('empresa_usuarios').insert({
        auth_user_id: authUserId,
        empresa_id: empresaId,
        email: email,
        nome: razaoSocial, // Fallback
        papel: 'admin',
        status: 'ativo'
      });
      
      if (vinculoError) throw vinculoError;

      setSalvoComSucesso(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);

    } catch (err: any) {
      setErro(err.message || "Erro ao realizar cadastro.");
    } finally {
      setIsCarregando(false);
    }
  };

  if (salvoComSucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F3E8FF] via-white to-[#EFF6FF] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-purple-100 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Realizado!</h2>
          <p className="text-gray-600 mb-6">Sua conta foi criada com sucesso. Você será redirecionado para o login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3E8FF] via-white to-[#EFF6FF] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity">
            <img src={logoImage} alt="Logo Diversidade.io" className="h-12 w-auto object-contain" />
            <span className="font-bold text-2xl" style={{ color: "#7030A0" }}>
              Diversidade.io
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cadastro</h1>
          <p className="text-gray-500 text-sm">
            {titulo}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
          <div
            className="h-1.5 w-full"
            style={{ background: "linear-gradient(to right, #7030A0, #0F3A7D)" }}
          />

          <div className="p-8">
            {erro && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cnpj" className="text-gray-700 font-medium text-sm">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className={`h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all ${cnpjErro ? 'border-red-500' : ''}`}
                  required
                />
                {buscandoCnpj && <p className="text-xs text-blue-600 mt-1">Buscando dados do CNPJ...</p>}
                {cnpjErro && <p className="text-xs text-red-600 mt-1">{cnpjErro}</p>}
                {cnpjValido && <p className="text-xs text-green-600 mt-1">CNPJ Validado: {razaoSocial}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-gray-700 font-medium text-sm">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium text-sm">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha" className="text-gray-700 font-medium text-sm">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className="h-12 bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition-all"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Mín. 8 caracteres, 1 número, 1 letra maiúscula, 1 caractere especial.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isCarregando || buscandoCnpj || !cnpjValido}
                className="w-full h-12 text-white font-semibold text-base rounded-xl shadow-md hover:shadow-lg hover:opacity-90 active:scale-[0.98] transition-all mt-2"
                style={{ backgroundColor: "#7030A0" }}
              >
                {isCarregando ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Cadastrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-5 h-5" />
                    Finalizar Cadastro
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="text-sm text-gray-500 hover:text-purple-700 transition-colors inline-flex items-center gap-1"
          >
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
