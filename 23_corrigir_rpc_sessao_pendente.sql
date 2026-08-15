-- Migracao 23: Corrigir RPC obter_sessao_usuario para aceitar usuarios convidados (status pendente)
-- 
-- O fluxo de convite cria o usuario em empresa_usuarios com status = 'pendente'.
-- Antes desta correcao, a RPC filtrava apenas status = 'ativo', impedindo
-- que usuarios convidados fizessem login apos definir a senha.
-- 
-- A correcao aceita tanto 'ativo' quanto 'pendente'. O status e atualizado
-- para 'ativo' pelo front-end (TrocarSenha.tsx) apos a senha ser definida.

CREATE OR REPLACE FUNCTION public.obter_sessao_usuario(p_auth_user_id UUID)
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
SET search_path = public
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
  FROM public.empresa_usuarios eu
  JOIN public.empresas e ON e.id = eu.empresa_id
  WHERE eu.auth_user_id = p_auth_user_id
    AND eu.status IN ('ativo', 'pendente')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.obter_sessao_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_sessao_usuario(UUID) TO anon;
