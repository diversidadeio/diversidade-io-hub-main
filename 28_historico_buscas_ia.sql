-- Migration: Histórico de buscas com IA por empresa incentivadora
-- Criado em: 2026-09-01

CREATE TABLE IF NOT EXISTS public.historico_buscas_ia (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      UUID NOT NULL,
  descricao       TEXT NOT NULL,
  resultados      JSONB NOT NULL DEFAULT '[]',
  total_resultados INTEGER NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_historico_ia_empresa
  ON public.historico_buscas_ia(empresa_id, criado_em DESC);

ALTER TABLE public.historico_buscas_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role acesso total" ON public.historico_buscas_ia
  USING (true)
  WITH CHECK (true);
