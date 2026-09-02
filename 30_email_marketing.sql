-- =============================================================
-- Migração 30: Módulo de E-mail Marketing
-- Cria a tabela de campanhas e o bucket de imagens no Storage
-- =============================================================

-- ── Tabela principal de campanhas ───────────────────────────
CREATE TABLE IF NOT EXISTS campanhas_email (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assunto       TEXT        NOT NULL,
  corpo_html    TEXT        NOT NULL,
  -- Filtro serializado: { tipo: 'todos'|'tipo_acesso'|'usuario'|'empresa', valores: [...] }
  filtro        JSONB       NOT NULL DEFAULT '{"tipo":"todos","valores":[]}',
  -- Status do ciclo de vida
  status        TEXT        NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho','agendado','enviando','enviado','erro')),
  agendado_para TIMESTAMPTZ,          -- NULL = envio imediato
  total_envios  INTEGER,              -- preenchido após o disparo
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em    TIMESTAMPTZ           -- preenchido quando status = 'enviado'
);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE campanhas_email ENABLE ROW LEVEL SECURITY;

-- Somente administradores podem ler e escrever campanhas
CREATE POLICY "admin_acesso_campanhas_email"
  ON campanhas_email
  USING (
    EXISTS (
      SELECT 1
        FROM empresa_usuarios eu
        JOIN empresas e ON eu.empresa_id = e.id
       WHERE eu.auth_user_id = auth.uid()
         AND e.tipo_usuario = 'adm'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM empresa_usuarios eu
        JOIN empresas e ON eu.empresa_id = e.id
       WHERE eu.auth_user_id = auth.uid()
         AND e.tipo_usuario = 'adm'
    )
  );

-- ── Bucket de imagens para e-mail marketing ─────────────────
-- Execute este bloco separadamente caso o bucket já exista.
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-marketing', 'email-marketing', true)
ON CONFLICT (id) DO NOTHING;

-- Permite que usuários autenticados façam upload no bucket
CREATE POLICY "autenticado_upload_email_marketing"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'email-marketing');

-- Permite leitura pública (necessário para as imagens aparecerem nos e-mails)
CREATE POLICY "publico_leitura_email_marketing"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'email-marketing');
