import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Dados do usuário autenticado na sessão.
 */
interface UsuarioSessao {
  empresaId: string;
  email: string;
  nomeResponsavel: string;
}

interface AuthContextType {
  usuario: UsuarioSessao | null;
  isLogado: boolean;
  isCarregando: boolean;
  login: (email: string, senha: string) => Promise<{ sucesso: boolean; erro?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const CHAVE_SESSAO = "diversidade_io_sessao";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [isCarregando, setIsCarregando] = useState(true);

  // Recupera a sessão salva no localStorage ao carregar a aplicação
  useEffect(() => {
    try {
      const sessaoSalva = localStorage.getItem(CHAVE_SESSAO);
      if (sessaoSalva) {
        const dadosSessao = JSON.parse(sessaoSalva) as UsuarioSessao;
        setUsuario(dadosSessao);
      }
    } catch {
      localStorage.removeItem(CHAVE_SESSAO);
    } finally {
      setIsCarregando(false);
    }
  }, []);

  /**
   * Realiza o login buscando o usuário na tabela 'empresas' pelo e-mail e senha.
   * Em caso de sucesso, persiste a sessão no localStorage.
   */
  const login = async (
    email: string,
    senha: string
  ): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const { data, error } = await supabase.rpc('autenticar_empresa', {
        p_email: email,
        p_senha: senha
      });

      if (error || !data) {
        return { sucesso: false, erro: "E-mail não encontrado ou senha incorreta." };
      }

      const sessao: UsuarioSessao = {
        empresaId: data.id,
        email: data.email,
        nomeResponsavel: data.nome_responsavel,
      };

      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      setUsuario(sessao);

      return { sucesso: true };
    } catch (err) {
      console.error("Erro ao realizar login:", err);
      return { sucesso: false, erro: "Ocorreu um erro inesperado. Tente novamente." };
    }
  };

  /**
   * Encerra a sessão do usuário removendo os dados do localStorage.
   */
  const logout = () => {
    localStorage.removeItem(CHAVE_SESSAO);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isLogado: !!usuario,
        isCarregando,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir o contexto de autenticação.
 * Deve ser usado dentro de um AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return ctx;
}
