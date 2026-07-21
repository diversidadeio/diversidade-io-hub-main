-- Migration 22: Sistema completo de logs de auditoria
-- Execute este script no SQL Editor do Supabase
-- Diversidade.io — 2026

-- 1. Criar tabela logs_acesso completa
--    (empresa_id é BIGINT para compatibilidade com empresas.id)
CREATE TABLE IF NOT EXISTS logs_acesso (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          BIGINT REFERENCES empresas(id) ON DELETE SET NULL,
  email               TEXT NOT NULL,
  tipo_evento         TEXT NOT NULL CHECK (tipo_evento IN (
                        'login_sucesso', 'login_falha', 'logout', 'troca_senha',
                        'adm_ver_empresa', 'adm_aprovar_empresa', 'adm_rejeitar_empresa', 'adm_gerar_senha',
                        'usuario_convidar', 'usuario_ver_empresa', 'usuario_pesquisa_empresa'
                      )),
  nome_empresa        TEXT,
  executor_adm_email  TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  detalhes            TEXT,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para performance nas queries da página de logs
CREATE INDEX IF NOT EXISTS idx_logs_email ON logs_acesso(email);
CREATE INDEX IF NOT EXISTS idx_logs_empresa_id ON logs_acesso(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_criado_em ON logs_acesso(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_evento ON logs_acesso(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_logs_executor_adm ON logs_acesso(executor_adm_email);

-- 3. RPC segura para inserir logs (SECURITY DEFINER contorna RLS)
--    Usada pelo servidor com service_role via supabaseAdmin.rpc(...)
CREATE OR REPLACE FUNCTION registrar_log_acesso(
  p_email              TEXT,
  p_tipo_evento        TEXT,
  p_empresa_id         BIGINT  DEFAULT NULL,
  p_nome_empresa       TEXT    DEFAULT NULL,
  p_executor_adm_email TEXT    DEFAULT NULL,
  p_ip_address         TEXT    DEFAULT NULL,
  p_user_agent         TEXT    DEFAULT NULL,
  p_detalhes           TEXT    DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO logs_acesso (
    email, tipo_evento, empresa_id, nome_empresa,
    executor_adm_email, ip_address, user_agent, detalhes
  ) VALUES (
    p_email, p_tipo_evento, p_empresa_id, p_nome_empresa,
    p_executor_adm_email, p_ip_address, p_user_agent, p_detalhes
  );
END;
$$;

-- 4. Ativar RLS e criar policy de leitura para admins
--    Admins são identificados pelo campo role = 'admin' na tabela profiles
ALTER TABLE logs_acesso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_podem_ver_logs" ON logs_acesso;

CREATE POLICY "admins_podem_ver_logs" ON logs_acesso
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Nota: INSERT é feito exclusivamente via RPC registrar_log_acesso (SECURITY DEFINER),
-- portanto não precisamos de policy de INSERT aberta.
