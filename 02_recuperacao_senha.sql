-- Migração para Recuperação de Senha

CREATE OR REPLACE FUNCTION solicitar_recuperacao_senha(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_empresa_id UUID;
  v_senha_plain TEXT;
BEGIN
  -- Busca o usuário pelo e-mail
  SELECT id INTO v_empresa_id FROM empresas WHERE email = p_email LIMIT 1;
  
  -- Se o e-mail não existir na base, retornamos nulo
  IF v_empresa_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Utiliza a função existente para gerar uma nova senha temporária
  v_senha_plain := gerar_senha_temporaria(v_empresa_id);
  
  RETURN v_senha_plain;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
