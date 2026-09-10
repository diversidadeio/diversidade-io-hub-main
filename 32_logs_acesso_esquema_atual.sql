-- Migration 32: Esquema canonico de logs_acesso
-- Execute este script no SQL Editor do Supabase
-- Diversidade.io - 2026
--
-- POR QUE ESTE ARQUIVO EXISTE
-- ---------------------------
-- A migration 22 criou logs_acesso com `empresa_id BIGINT` e uma constraint
-- CHECK listando 11 tipos de evento. Depois, o script avulso fix_logs_acesso.sql
-- fez DROP TABLE ... CASCADE e recriou a tabela com `empresa_id UUID` e sem a
-- CHECK -- que e o formato realmente em producao hoje (verificado no banco).
--
-- Efeitos colaterais daquele DROP que este script corrige:
--   1. Os cinco indices criados pela migration 22 foram perdidos e nunca
--      recriados. Em producao so restou a PK, entao todo filtro da tela de
--      Logs (ordenar por criado_em, filtrar por tipo_evento/email/empresa_id)
--      faz varredura sequencial.
--   2. Nao ha mais CHECK em tipo_evento. Isso e intencional: a aplicacao ja
--      emite 24 tipos distintos e a lista cresce a cada funcionalidade nova.
--      A fonte da verdade para rotulos e BADGE_CONFIG em client/src/pages/adm/Logs.tsx.
--
-- Este script e idempotente e reflete o estado real do banco: pode ser rodado
-- tanto em producao (onde so criara os indices que faltam) quanto num ambiente
-- novo (onde criara tudo do zero).

-- 1. Tabela -----------------------------------------------------------------
--    empresa_id e UUID: referencia empresas.id, que tambem e UUID.
CREATE TABLE IF NOT EXISTS logs_acesso (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  tipo_evento         TEXT NOT NULL,
  empresa_id          UUID,
  nome_empresa        TEXT,
  executor_adm_email  TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  detalhes            TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indices ----------------------------------------------------------------
--    Correspondem exatamente aos filtros aplicados por api/logs.ts.
CREATE INDEX IF NOT EXISTS idx_logs_criado_em    ON logs_acesso(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_evento  ON logs_acesso(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_logs_email        ON logs_acesso(email);
CREATE INDEX IF NOT EXISTS idx_logs_empresa_id   ON logs_acesso(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_executor_adm ON logs_acesso(executor_adm_email);

-- 3. RPC de escrita ---------------------------------------------------------
--    SECURITY DEFINER: e o unico caminho de INSERT, usado pelo servidor
--    (api/registrar-log.ts e api/busca-ia.ts) com a serviceRole.
CREATE OR REPLACE FUNCTION registrar_log_acesso(
  p_email              TEXT,
  p_tipo_evento        TEXT,
  p_empresa_id         UUID DEFAULT NULL,
  p_nome_empresa       TEXT DEFAULT NULL,
  p_executor_adm_email TEXT DEFAULT NULL,
  p_ip_address         TEXT DEFAULT NULL,
  p_user_agent         TEXT DEFAULT NULL,
  p_detalhes           TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. RLS --------------------------------------------------------------------
--    Este script NAO altera as policies existentes. O estado atual, apurado
--    no banco em 10/09/2026, e o seguinte:
--
--    a) "empresas_podem_ver_seus_logs"  USING (empresa_id = auth.uid())
--       ESTA ATIVA E FUNCIONA. Em 496 das 536 empresas o `empresas.id` foi
--       criado igual ao id do usuario no Supabase Auth, entao esses usuarios
--       conseguem ler os proprios registros direto do navegador -- incluindo
--       os eventos adm_* sobre a propria empresa (qual admin abriu o cadastro
--       e quando). Se isso nao for desejado, e uma decisao de produto: troque
--       o USING por uma checagem via empresa_usuarios.auth_user_id.
--
--    b) "admins_podem_ver_logs"
--       USING (EXISTS (SELECT 1 FROM empresas WHERE id = auth.uid()
--                      AND tipo_usuario = 'adm'))
--       ESTA INATIVA NA PRATICA: nenhum dos administradores atuais tem
--       `empresas.id` igual ao proprio auth.uid(), entao a condicao nunca e
--       satisfeita. Mantida por nao custar nada, mas nao confie nela.
--
--    A tela de Logs nao depende de nenhuma das duas: le por api/logs.ts, que
--    roda com serviceRole (ignora RLS) e valida o token do administrador
--    antes de responder -- ver api/_auth.ts.
ALTER TABLE logs_acesso ENABLE ROW LEVEL SECURITY;
