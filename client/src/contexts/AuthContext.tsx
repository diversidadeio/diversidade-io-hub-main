import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Dados do usuário autenticado na sessão.
 */
interface UsuarioSessao {
  empresaId: string;
  email: string;
  nomeResponsavel: string;
  tipoUsuario: 'empresa' | 'adm';
  senhaTemporaria: boolean;
  expiraEm: number; // Timestamp em milissegundos
}

interface AuthContextType {
  usuario: UsuarioSessao | null;
  isLogado: boolean;
  isAdm: boolean;
  senhaTemporaria: boolean;
  isCarregando: boolean;
  login: (email: string, senha: string) => Promise<{ sucesso: boolean; erro?: string; tipoUsuario?: 'empresa' | 'adm'; senhaTemporaria?: boolean }>;
  logout: () => void;
  atualizarSessao: (dados: Partial<UsuarioSessao>) => void;
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
        
        // Verifica se a sessão expirou
        if (Date.now() > dadosSessao.expiraEm) {
          localStorage.removeItem(CHAVE_SESSAO);
          setUsuario(null);
        } else {
          setUsuario(dadosSessao);
        }
      }
    } catch {
      localStorage.removeItem(CHAVE_SESSAO);
    } finally {
      setIsCarregando(false);
    }
  }, []);

  const hashPassword = async (password: string) => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  /**
   * Realiza o login buscando o usuário na tabela 'empresas' pelo e-mail e senha.
   * Em caso de sucesso, persiste a sessão no localStorage.
   */
  const login = async (
    email: string,
    senha: string
  ): Promise<{ sucesso: boolean; erro?: string; tipoUsuario?: 'empresa' | 'adm'; senhaTemporaria?: boolean }> => {
    try {
      const senhaHasheada = await hashPassword(senha);
      const { data, error } = await supabase.rpc('autenticar_empresa', {
        p_email: email,
        p_senha: senhaHasheada
      });

      // Como a RPC agora retorna TABLE, o SupabaseJS pode devolver um array.
      const userData = Array.isArray(data) ? data[0] : data;

      if (error || !userData) {
        return { sucesso: false, erro: "E-mail não encontrado ou senha incorreta." };
      }

      // Define expiração para 8 horas a partir de agora
      const OITO_HORAS_EM_MS = 8 * 60 * 60 * 1000;
      const sessao: UsuarioSessao = {
        empresaId: userData.id,
        email: userData.email,
        nomeResponsavel: userData.nome_responsavel,
        tipoUsuario: userData.tipo_usuario || 'empresa',
        senhaTemporaria: userData.senha_temporaria || false,
        expiraEm: Date.now() + OITO_HORAS_EM_MS,
      };

      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      setUsuario(sessao);

      return { 
        sucesso: true, 
        tipoUsuario: sessao.tipoUsuario,
        senhaTemporaria: sessao.senhaTemporaria
      };
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

  /**
   * Atualiza parcialmente os dados da sessão (ex: quando a senha temporária é redefinida)
   */
  const atualizarSessao = (dados: Partial<UsuarioSessao>) => {
    if (!usuario) return;
    const novaSessao = { ...usuario, ...dados };
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(novaSessao));
    setUsuario(novaSessao);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isLogado: !!usuario,
        isAdm: usuario?.tipoUsuario === 'adm',
        senhaTemporaria: usuario?.senhaTemporaria || false,
        isCarregando,
        login,
        logout,
        atualizarSessao,
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
