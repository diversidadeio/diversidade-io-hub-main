-- =============================================================
-- Migração 31: Status de situação CNPJ das empresas
-- Adiciona campos para armazenar o resultado da consulta
-- à Receita Federal via BrasilAPI
-- =============================================================

-- Adiciona os dois novos campos na tabela empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS situacao_cnpj TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS situacao_cnpj_verificado_em TIMESTAMPTZ DEFAULT NULL;

-- Índice para facilitar filtros e contagens por situação
CREATE INDEX IF NOT EXISTS idx_empresas_situacao_cnpj
  ON empresas(situacao_cnpj)
  WHERE situacao_cnpj IS NOT NULL;

-- Documentação dos valores possíveis
COMMENT ON COLUMN empresas.situacao_cnpj IS
  ''Situação cadastral na Receita Federal obtida via BrasilAPI. ''
  ''Valores possíveis: ATIVA, INAPTA, BAIXADA, SUSPENSA, NULA, ou NULL (nunca verificado). ''
  ''O valor é normalizado para maiúsculas sem acentos.'';

COMMENT ON COLUMN empresas.situacao_cnpj_verificado_em IS
  ''Data e hora da última verificação do CNPJ na BrasilAPI. ''
  ''NULL indica que o CNPJ ainda não foi verificado.'';
