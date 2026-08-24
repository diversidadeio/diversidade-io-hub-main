-- Migration 25: Adiciona coluna de responsáveis (admins) nas solicitações de busca
-- Segue o mesmo padrão de empresas_indicadas (array de UUIDs)

ALTER TABLE public.solicitacoes_busca
  ADD COLUMN IF NOT EXISTS responsavel_adm_ids UUID[] DEFAULT '{}';
