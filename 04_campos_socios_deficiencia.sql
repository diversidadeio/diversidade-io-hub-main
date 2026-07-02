-- ============================================================
-- Migração 04: Novos campos detalhados de Deficiência na tabela socios
-- Execute no SQL Editor do Supabase (projeto ezvpveejlofauixfpizs)
-- ============================================================

-- A tabela `socios` já possui o campo `deficiencia` TEXT.
-- Os campos abaixo irão detalhar o grau caso o usuário selecione
-- as opções correspondentes.

ALTER TABLE socios ADD COLUMN IF NOT EXISTS deficiencia_auditiva_grau TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS deficiencia_fisica_grau TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS deficiencia_intelectual_grau TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS deficiencia_psicossocial_grau TEXT;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS deficiencia_visual_grau TEXT;

-- Comentários para documentação
COMMENT ON COLUMN socios.deficiencia IS 'Pode conter múltiplos valores (ex: "Deficiência física, Deficiência visual")';
COMMENT ON COLUMN socios.deficiencia_auditiva_grau IS 'Ex: Perda unilateral, Perda bilateral, etc.';
COMMENT ON COLUMN socios.deficiencia_fisica_grau IS 'Ex: Paraparesia, Monoplegia, etc.';
COMMENT ON COLUMN socios.deficiencia_intelectual_grau IS 'Ex: Comunicação, Cuidado pessoal, etc.';
COMMENT ON COLUMN socios.deficiencia_psicossocial_grau IS 'Ex: Mania, Esquizofrenia, Depressão, etc.';
COMMENT ON COLUMN socios.deficiencia_visual_grau IS 'Ex: Cegueira monocular, Daltonismo, etc.';

-- ============================================================
-- Verificação
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'socios'
ORDER BY ordinal_position;
