-- Migração 15: Adiciona campo status_aprovacao na tabela empresas
-- Empresas existentes já ficam aprovadas; novos cadastros ficam pendentes por padrão.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS status_aprovacao TEXT NOT NULL DEFAULT 'pendente'
  CHECK (status_aprovacao IN ('pendente', 'aprovado', 'rejeitado'));

-- Aprova todos os registros existentes
UPDATE empresas
  SET status_aprovacao = 'aprovado'
  WHERE status_aprovacao = 'pendente';

-- Atualiza a RPC obter_sessao_usuario para retornar o status_aprovacao
CREATE OR REPLACE FUNCTION obter_sessao_usuario(p_auth_user_id UUID)
RETURNS TABLE (
  empresa_id       UUID,
  email            TEXT,
  nome             TEXT,
  foto_url         TEXT,
  nome_responsavel TEXT,
  tipo_usuario     TEXT,
  papel            TEXT,
  status_aprovacao TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    e.id              AS empresa_id,
    eu.email          AS email,
    eu.nome           AS nome,
    eu.foto_url       AS foto_url,
    e.nome_responsavel AS nome_responsavel,
    e.tipo_usuario    AS tipo_usuario,
    eu.papel          AS papel,
    e.status_aprovacao AS status_aprovacao
  FROM empresa_usuarios eu
  JOIN empresas e ON e.id = eu.empresa_id
  WHERE eu.auth_user_id = p_auth_user_id
    AND eu.status = 'ativo'
  LIMIT 1;
$$;
