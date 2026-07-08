-- Atualizar a função obter_sessao_usuario para retornar os dados corretos do usuário (da tabela empresa_usuarios)
-- ao invés dos dados gerais da empresa (nome_responsavel).

DROP FUNCTION IF EXISTS obter_sessao_usuario(UUID);

CREATE OR REPLACE FUNCTION obter_sessao_usuario(p_auth_user_id UUID)
RETURNS TABLE (
  empresa_id UUID,
  email TEXT,
  nome TEXT,
  foto_url TEXT,
  tipo_usuario TEXT,
  papel TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS empresa_id, 
    eu.email, 
    eu.nome,
    eu.foto_url,
    e.tipo_usuario,
    eu.papel
  FROM public.empresa_usuarios eu
  JOIN public.empresas e ON e.id = eu.empresa_id
  WHERE eu.auth_user_id = p_auth_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION obter_sessao_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION obter_sessao_usuario(UUID) TO anon;
