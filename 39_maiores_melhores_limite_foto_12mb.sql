-- Migration 39: Maiores & Melhores — limite da foto do rosto sobe de 4 MB para 12 MB
-- Diversidade.io — 2026
--
-- O bucket privado "maiores-melhores" (migration 34) aceitava arquivos de até 4 MB. Fotos de celular
-- passam disso com facilidade. O navegador continua reduzindo qualquer foto acima de 12 MB antes do envio.
--
-- Execute no SQL Editor do Supabase.

UPDATE storage.buckets
   SET file_size_limit = 12582912  -- 12 MB
 WHERE id = 'maiores-melhores';
