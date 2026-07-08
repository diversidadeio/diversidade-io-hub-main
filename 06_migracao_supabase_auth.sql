-- Migração para Supabase Auth

-- 1. Adicionar o vínculo com o auth.users
ALTER TABLE public.empresa_usuarios 
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Garantir que um usuário Auth só possa estar em uma empresa_usuarios (se quisermos limitar)
-- CREATE UNIQUE INDEX idx_empresa_usuarios_auth_user ON public.empresa_usuarios(auth_user_id);

-- 3. Função para obter os dados de sessão do usuário logado no Auth
CREATE OR REPLACE FUNCTION obter_sessao_usuario(p_auth_user_id UUID)
RETURNS TABLE (
  empresa_id UUID,
  email TEXT,
  nome_responsavel TEXT,
  tipo_usuario TEXT,
  papel TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS empresa_id, 
    eu.email, 
    e.nome_responsavel,
    e.tipo_usuario,
    eu.papel
  FROM public.empresa_usuarios eu
  JOIN public.empresas e ON e.id = eu.empresa_id
  WHERE eu.auth_user_id = p_auth_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para auto-migração: quando um usuário for criado no auth.users, se o e-mail existir na tabela empresas, cria o vínculo
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id UUID;
  v_nome TEXT;
BEGIN
  -- Verifica se existe uma empresa com esse e-mail (dono original)
  SELECT id, nome_responsavel INTO v_empresa_id, v_nome FROM public.empresas WHERE email = NEW.email LIMIT 1;
  
  IF v_empresa_id IS NOT NULL THEN
    -- Insere na tabela empresa_usuarios como admin
    INSERT INTO public.empresa_usuarios (auth_user_id, empresa_id, email, nome, papel, status)
    VALUES (NEW.id, v_empresa_id, NEW.email, v_nome, 'admin', 'ativo')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
