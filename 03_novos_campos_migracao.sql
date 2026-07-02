-- ============================================================
-- Migração 03: Novos campos na tabela empresas
-- Execute no SQL Editor do Supabase (projeto ezvpveejlofauixfpizs)
-- ============================================================

-- 1. Porte da empresa (vindo do campo Porte_empresa do Bubble)
--    Valores possíveis no banco antigo: MEI, ME, MICRO, EPP, EMP, Média Empresa, Grande Empresa
ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS porte_empresa TEXT;

COMMENT ON COLUMN empresas.porte_empresa IS 'Porte da empresa: MEI | ME | MICRO | EPP | EMP | Média Empresa | Grande Empresa';

-- 2. Atividade empresarial principal (vindo do campo Atividade_empresarial do Bubble)
--    Campo separado de sobre_empresa — não concatenar
ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS atividade_empresarial TEXT;

COMMENT ON COLUMN empresas.atividade_empresarial IS 'Atividade empresarial principal (ex: CNAE descritivo), migrado do campo Atividade_empresarial do Bubble';

-- ============================================================
-- Verificação: listar as colunas da tabela após a migração
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'empresas'
ORDER BY ordinal_position;
