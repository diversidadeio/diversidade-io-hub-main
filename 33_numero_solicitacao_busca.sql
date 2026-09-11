-- Migration 33: Numero sequencial de solicitacoes de busca (ex: 001/2026, 002/2026)
-- O registro ja existente na plataforma recebe 002/2026.
-- (001/2026 foi gerada fora da plataforma e nao esta no banco.)

-- 1. Adiciona a coluna (nullable para nao quebrar registros existentes)
ALTER TABLE public.solicitacoes_busca
  ADD COLUMN IF NOT EXISTS numero TEXT;

-- 2. Atribui 002/2026 ao unico registro existente (ou ao mais antigo se houver varios)
UPDATE public.solicitacoes_busca
SET    numero = '002/2026'
WHERE  numero IS NULL
  AND  criado_em = (SELECT MIN(criado_em) FROM public.solicitacoes_busca);

-- 3. Funcao auxiliar: devolve o proximo numero no formato NNN/AAAA
--    Leva em conta o ano para reiniciar a contagem a cada ano.
CREATE OR REPLACE FUNCTION public.proximo_numero_solicitacao_busca(p_ano INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ultimo  INT;
  v_proximo INT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(numero, '/', 1) AS INT)),
    0
  )
  INTO v_ultimo
  FROM public.solicitacoes_busca
  WHERE numero LIKE '%/' || p_ano::TEXT;

  v_proximo := v_ultimo + 1;
  RETURN LPAD(v_proximo::TEXT, 3, '0') || '/' || p_ano::TEXT;
END;
$$;

-- 4. Funcao do trigger: preenche o numero automaticamente em cada INSERT
CREATE OR REPLACE FUNCTION public.preencher_numero_solicitacao_busca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.criado_em, now()))::INT;

  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.proximo_numero_solicitacao_busca(v_ano);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_numero_solicitacao_busca ON public.solicitacoes_busca;

CREATE TRIGGER trigger_numero_solicitacao_busca
  BEFORE INSERT ON public.solicitacoes_busca
  FOR EACH ROW
  EXECUTE FUNCTION public.preencher_numero_solicitacao_busca();
