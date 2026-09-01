-- Migration: Suporte a histórico de busca com IA para administradores
-- Criado em: 2026-09-01

ALTER TABLE public.historico_buscas_ia ALTER COLUMN empresa_id DROP NOT NULL;
ALTER TABLE public.historico_buscas_ia ADD COLUMN IF NOT EXISTS admin_email TEXT;
CREATE INDEX IF NOT EXISTS idx_historico_ia_admin ON public.historico_buscas_ia(admin_email, criado_em DESC);
