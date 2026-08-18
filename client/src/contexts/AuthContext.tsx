import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { registrarLog } from "@/lib/registrarLog";

/**
 * Dados do usuário autenticado na sessão.
 */
interface UsuarioSessao {
  id: string;
  empresaId: string;
  email: string;
  nome: string;
  fotoUrl: string | null;
  nomeResponsavel: string;
  tipoUsuario: 'empresa' | 'adm';
  senhaTemporaria: boolean;
  papel?: 'admin' | 'usuario';
  statusAprovacao: 'pendente' | 'aprovado' | 'rejeitado';
  expiraEm: number; // Timestamp em milissegundos
}

interface AuthContextType {
  usuario: UsuarioSessao | null;
  isLogado: boolean;
  isAdm: boolean;
  isPendente: boolean;
  senhaTemporaria: boolean;
  isCarregando: boolean;
  login: (email: string, senha: string) => Promise<{ sucesso: boolean; erro?: string; tipoUsuario?: 'empresa' | 'adm'; senhaTemporaria?: boolean; isPendente?: boolean }>;
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
          // Revalida status de aprovação em background
          if (dadosSessao.tipoUsuario === 'empresa' && dadosSessao.empresaId) {
            supabase
              .from('empresas')
              .select('status_aprovacao')
              .eq('id', dadosSessao.empresaId)
              .single()
              .then(({ data }) => {
                if (data && data.status_aprovacao !== dadosSessao.statusAprovacao) {
                  const novaSessao = { ...dadosSessao, statusAprovacao: data.status_aprovacao };
                  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(novaSessao));
                  setUsuario(novaSessao);
                }
              });
          }
        }
      }
    } catch {
      localStorage.removeItem(CHAVE_SESSAO);
    } finally {
      setIsCarregando(false);
    }
  }, []);

  // Escuta mudanças na tabela empresas para atualizar o status de aprovação em tempo real
  useEffect(() => {
    if (!usuario || usuario.tipoUsuario !== 'empresa') return;

    const channel = supabase
      .channel(`empresa_status_${usuario.empresaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'empresas',
          filter: `id=eq.${usuario.empresaId}`,
        },
        (payload) => {
          const novoStatus = payload.new.status_aprovacao;
          if (novoStatus) {
            setUsuario((prevUsuario) => {
              if (!prevUsuario || prevUsuario.statusAprovacao === novoStatus) return prevUsuario;
              const novaSessao = { ...prevUsuario, statusAprovacao: novoStatus as any };
              localStorage.setItem(CHAVE_SESSAO, JSON.stringify(novaSessao));
              return novaSessao;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario?.empresaId, usuario?.tipoUsuario]);

  const hashPassword = async (password: string) => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const login = async (
    email: string,
    senha: string
  ): Promise<{ sucesso: boolean; erro?: string; tipoUsuario?: 'empresa' | 'adm'; senhaTemporaria?: boolean; isPendente?: boolean }> => {
    try {
      // 1. Autentica no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (authError || !authData?.user) {
        // Registra log de falha de login
        registrarLog({
          tipo_evento: 'login_falha',
          email,
          detalhes: authError?.message || 'Credenciais inválidas',
        });
        try {
          const checkRes = await fetch("/api/verificar-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData && checkData.existe === false) {
              return { sucesso: false, erro: "E-mail não cadastrado. Por favor, realize o seu cadastro." };
            }
          }
        } catch (e) {
          console.error("Erro ao verificar email:", e);
        }

        return { sucesso: false, erro: "Senha incorreta." };
      }

      // 2. Busca dados de sessão via RPC (une profiles + empresas)
      const { data, error } = await supabase.rpc('obter_sessao_usuario', {
        p_auth_user_id: authData.user.id
      });

      const userData = Array.isArray(data) ? data[0] : data;

      if (error || !userData) {
        await supabase.auth.signOut();
        return { sucesso: false, erro: "Perfil de usuário não encontrado. Entre em contato com o suporte." };
      }

      // 3. Verifica se a senha é temporária (consultando a tabela empresas)
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('senha_temporaria')
        .eq('id', userData.empresa_id)
        .single();
        
      const isSenhaTemporaria = empresaData?.senha_temporaria || false;

      // 4. Monta a sessão local (expira em 8 horas)
      const OITO_HORAS_EM_MS = 8 * 60 * 60 * 1000;
      const sessao: UsuarioSessao = {
        id: userData.id || authData.user.id,
        empresaId: userData.empresa_id,
        email: userData.email,
        nome: userData.nome,
        fotoUrl: userData.foto_url,
        nomeResponsavel: userData.nome_responsavel,
        tipoUsuario: userData.tipo_usuario as 'empresa' | 'adm',
        papel: userData.papel as 'admin' | 'usuario',
        senhaTemporaria: isSenhaTemporaria,
        statusAprovacao: userData.status_aprovacao as 'pendente' | 'aprovado' | 'rejeitado',
        expiraEm: Date.now() + OITO_HORAS_EM_MS,
      };

      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      setUsuario(sessao);

      // Registra log de login com sucesso
      registrarLog({
        tipo_evento: 'login_sucesso',
        email: sessao.email,
        empresa_id: sessao.empresaId,
        nome_empresa: sessao.nome,
      });

      return {
        sucesso: true,
        tipoUsuario: sessao.tipoUsuario,
        senhaTemporaria: isSenhaTemporaria,
        isPendente: sessao.tipoUsuario !== 'adm' && sessao.statusAprovacao !== 'aprovado',
      };
    } catch (err) {
      console.error("Erro ao realizar login:", err);
      return { sucesso: false, erro: "Ocorreu um erro inesperado. Tente novamente." };
    }
  };

  /**
   * Encerra a sessão do usuário removendo os dados do localStorage e do Supabase Auth.
   */
  const logout = async () => {
    // Registra log de logout antes de limpar a sessão
    if (usuario) {
      registrarLog({
        tipo_evento: 'logout',
        email: usuario.email,
        empresa_id: usuario.empresaId,
        nome_empresa: usuario.nome,
      });
    }
    await supabase.auth.signOut();
    localStorage.removeItem(CHAVE_SESSAO);
    setUsuario(null);
  };

  /**
   * Atualiza parcialmente os dados da sessão (ex: quando a senha temporária é redefinida)
   */
  const atualizarSessao = (dados: Partial<UsuarioSessao>) => {
    setUsuario((prevUsuario) => {
      if (!prevUsuario) return prevUsuario;
      const novaSessao = { ...prevUsuario, ...dados };
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(novaSessao));
      return novaSessao;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isLogado: !!usuario,
        isAdm: usuario?.tipoUsuario === 'adm',
        isPendente: usuario?.tipoUsuario !== 'adm' && usuario?.statusAprovacao !== 'aprovado',
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
