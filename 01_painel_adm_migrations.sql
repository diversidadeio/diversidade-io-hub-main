-- Migrações de Banco de Dados para o Painel ADM
-- Execute este script no SQL Editor do Supabase

-- 1. Novos campos na tabela empresas
ALTER TABLE empresas 
ADD COLUMN tipo_usuario TEXT NOT NULL DEFAULT 'empresa'
  CHECK (tipo_usuario IN ('empresa', 'adm'));

ALTER TABLE empresas
ADD COLUMN senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabela de solicitações de exclusão
CREATE TABLE solicitacoes_exclusao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  razao_social TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'concluida', 'revertida')),
  motivo TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  resolvido_em TIMESTAMPTZ,
  resolvido_por_adm_email TEXT
);

-- 3. Tabela de logs de acesso
CREATE TABLE logs_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('login_sucesso', 'login_falha', 'logout')),
  ip_address TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Nova função RPC para Gerar Senha Temporária (ADM)
CREATE OR REPLACE FUNCTION gerar_senha_temporaria(p_empresa_id UUID)
RETURNS TEXT AS $$
DECLARE
  senha_plain TEXT;
  senha_hash  TEXT;
BEGIN
  -- Gera senha aleatória de 10 caracteres alfanuméricos
  senha_plain := upper(substring(md5(random()::text) FROM 1 FOR 5))
                 || lower(substring(md5(random()::text) FROM 1 FOR 5));
  
  -- Hash SHA-256 (compatível com o hash feito no front-end em crypto.subtle)
  senha_hash := encode(sha256(senha_plain::bytea), 'hex');

  UPDATE empresas
  SET senha_hash = senha_hash,
      senha_temporaria = TRUE
  WHERE id = p_empresa_id;

  RETURN senha_plain;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Nova função RPC para Redefinir Senha (Usuário)
CREATE OR REPLACE FUNCTION redefinir_senha(p_empresa_id UUID, p_nova_senha_hash TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE empresas
  SET senha_hash = p_nova_senha_hash,
      senha_temporaria = FALSE
  WHERE id = p_empresa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atualizar a função autenticar_empresa para retornar as novas flags
-- NOTA: Você precisará substituir a função autenticar_empresa atual.
-- Este é um modelo de como a assinatura de retorno deve ficar.
-- Verifique a função existente no seu painel para não quebrar outras partes,
-- mas a alteração principal é adicionar tipo_usuario e senha_temporaria no SELECT.

DROP FUNCTION IF EXISTS autenticar_empresa(text, text);

CREATE OR REPLACE FUNCTION autenticar_empresa(p_email TEXT, p_senha TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  nome_responsavel TEXT,
  tipo_usuario TEXT,
  senha_temporaria BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id, 
    e.email, 
    e.nome_responsavel,
    e.tipo_usuario,
    e.senha_temporaria
  FROM empresas e
  WHERE e.email = p_email 
    AND e.senha_hash = p_senha;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
