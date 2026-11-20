-- Migration 35: Maiores & Melhores — foto do rosto por sócio
-- Diversidade.io — 2026
--
-- O que muda em relação à migration 34:
--  1. A foto deixa de ser da empresa e passa a ser de cada sócio ou titular.
--     Cada item de mm_empresas.socios agora aceita foto_path e foto_autorizada.
--  2. Nas empresas Afroempreendedoras, o primeiro sócio é o responsável pela inscrição
--     (o nome precisa ser igual ao campo "responsável").
--  3. A autorização de uso da foto é exigida (e guardada) para cada foto enviada.
--  4. A coluna mm_empresas.foto_path é removida. Fotos já enviadas são movidas para o
--     sócio com o nome do responsável (ou, se não houver, para o primeiro sócio).
--
-- Execute no SQL Editor do Supabase depois da migration 34.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Migra as fotos já enviadas e remove a coluna antiga
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mm_empresas' AND column_name = 'foto_path'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.mm_empresas WHERE foto_path IS NOT NULL AND jsonb_array_length(socios) = 0) THEN
      RAISE EXCEPTION 'Há inscrições com foto e sem sócio para vincular. Revise esses registros antes de aplicar a migration 35.';
    END IF;

    WITH alvo AS (
      SELECT e.id,
             coalesce((
               SELECT (x.n - 1)::int
               FROM jsonb_array_elements(e.socios) WITH ORDINALITY AS x(el, n)
               WHERE lower(x.el->>'nome') = lower(e.responsavel)
               ORDER BY x.n
               LIMIT 1
             ), 0) AS idx
      FROM public.mm_empresas e
      WHERE e.foto_path IS NOT NULL AND jsonb_array_length(e.socios) > 0
    )
    UPDATE public.mm_empresas e
       SET socios = jsonb_set(
             e.socios,
             ARRAY[a.idx::text],
             (e.socios -> a.idx) || jsonb_build_object('foto_path', e.foto_path, 'foto_autorizada', TRUE)
           )
      FROM alvo a
     WHERE a.id = e.id;

    DROP INDEX IF EXISTS public.mm_empresas_foto_unica;
    ALTER TABLE public.mm_empresas DROP COLUMN foto_path;
  END IF;
END $$;

COMMENT ON COLUMN public.mm_empresas.socios IS
  'Lista de {nome, declaracao, foto_path?, foto_autorizada?}. Na categoria afro, o primeiro item é o responsável pela inscrição.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Funções internas
-- ───────────────────────────────────────────────────────────────────────────

-- A foto já está ligada a algum sócio?
CREATE OR REPLACE FUNCTION public.mm_foto_em_uso(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mm_empresas e, jsonb_array_elements(e.socios) s
    WHERE s->>'foto_path' = p_path
  )
$$;

-- Sócios como o participante pode ver: sem o caminho da foto, só se existe
CREATE OR REPLACE FUNCTION public.mm_socios_publicos(p_socios JSONB)
RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'nome',       s.e->>'nome',
             'declaracao', s.e->>'declaracao',
             'tem_foto',   (s.e->>'foto_path') IS NOT NULL)
           ORDER BY s.n), '[]'::jsonb)
  FROM jsonb_array_elements(p_socios) WITH ORDINALITY AS s(e, n)
$$;

REVOKE EXECUTE ON FUNCTION public.mm_foto_em_uso(TEXT)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_socios_publicos(JSONB) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Inscrição da empresa (substitui a função da migration 34)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_inscrever_empresa(p_token TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part    UUID := public.mm_participante_id(p_token);
  v_evento  UUID := public.mm_evento_aberto_id();
  v_cat     TEXT := coalesce(p_dados->>'categoria', '');
  v_porte   TEXT := coalesce(p_dados->>'porte', '');
  v_razao   TEXT := btrim(coalesce(p_dados->>'razao_social', ''));
  v_cnpj    TEXT := public.mm_normalizar_cnpj(p_dados->>'cnpj');
  v_resp    TEXT := btrim(coalesce(p_dados->>'responsavel', ''));
  v_email   TEXT := lower(btrim(coalesce(p_dados->>'email', '')));
  v_mun     TEXT := btrim(coalesce(p_dados->>'municipio', ''));
  v_uf      TEXT := upper(btrim(coalesce(p_dados->>'uf', '')));
  v_socios  JSONB := coalesce(p_dados->'socios', '[]'::jsonb);
  v_limpos  JSONB;
  v_fotos   TEXT[];
  v_id      UUID;
BEGIN
  IF v_cat NOT IN ('afro', 'inclusiva') THEN
    RAISE EXCEPTION 'Selecione a categoria da inscrição.';
  END IF;
  IF v_porte NOT IN ('MEI', 'Micro', 'Pequena', 'Média', 'Grande') THEN
    RAISE EXCEPTION 'Selecione o porte da empresa.';
  END IF;
  IF v_cat = 'inclusiva' AND v_porte NOT IN ('Média', 'Grande') THEN
    RAISE EXCEPTION 'Selecione porte médio ou grande para a categoria Empresas inclusivas.';
  END IF;
  IF length(v_razao) NOT BETWEEN 2 AND 180 THEN
    RAISE EXCEPTION 'Informe a razão social.';
  END IF;
  IF NOT public.mm_cnpj_valido(v_cnpj) THEN
    RAISE EXCEPTION 'Confira os 14 caracteres e os dígitos finais do CNPJ.';
  END IF;
  IF length(v_resp) NOT BETWEEN 2 AND 180 THEN
    RAISE EXCEPTION 'Informe o responsável pela inscrição.';
  END IF;
  IF NOT public.mm_email_valido(v_email) THEN
    RAISE EXCEPTION 'Confira o e-mail de contato.';
  END IF;
  IF length(v_mun) NOT BETWEEN 2 AND 180 THEN
    RAISE EXCEPTION 'Informe o município.';
  END IF;
  IF v_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN
    RAISE EXCEPTION 'Selecione a UF.';
  END IF;
  IF (p_dados->>'consentimento') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Confirme a declaração de veracidade das informações.';
  END IF;

  -- Sócios e titulares
  IF jsonb_typeof(v_socios) <> 'array' THEN
    RAISE EXCEPTION 'Confira a lista de sócios e titulares.';
  END IF;
  IF jsonb_array_length(v_socios) > 100 THEN
    RAISE EXCEPTION 'Informe até 100 sócios ou titulares.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_socios) s WHERE jsonb_typeof(s) <> 'object') THEN
    RAISE EXCEPTION 'Confira a lista de sócios e titulares.';
  END IF;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'nome',       btrim(coalesce(s.e->>'nome', '')),
             'declaracao', coalesce(s.e->>'declaracao', ''))
           || CASE
                WHEN nullif(btrim(coalesce(s.e->>'foto_path', '')), '') IS NOT NULL
                THEN jsonb_build_object(
                       'foto_path',       btrim(s.e->>'foto_path'),
                       'foto_autorizada', (s.e->>'foto_autorizada') = 'true')
                ELSE '{}'::jsonb
              END
           ORDER BY s.n), '[]'::jsonb)
    INTO v_limpos
  FROM jsonb_array_elements(v_socios) WITH ORDINALITY AS s(e, n);

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_limpos) s
    WHERE length(s->>'nome') NOT BETWEEN 2 AND 180
       OR s->>'declaracao' NOT IN ('preta_parda', 'outra', 'nao_informada')
  ) THEN
    RAISE EXCEPTION 'Confira o nome e a autodeclaração de cada sócio ou titular.';
  END IF;

  IF v_cat = 'afro' THEN
    IF jsonb_array_length(v_limpos) = 0 OR lower(v_limpos->0->>'nome') <> lower(v_resp) THEN
      RAISE EXCEPTION 'O responsável pela inscrição deve ser o primeiro sócio ou titular.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_limpos) s WHERE s->>'declaracao' = 'preta_parda') THEN
      RAISE EXCEPTION 'Informe pelo menos um sócio ou titular com autodeclaração preta ou parda.';
    END IF;
  END IF;

  -- Fotos (uma opcional por sócio)
  SELECT coalesce(array_agg(s->>'foto_path'), ARRAY[]::TEXT[])
    INTO v_fotos
  FROM jsonb_array_elements(v_limpos) s
  WHERE s->>'foto_path' IS NOT NULL;

  IF cardinality(v_fotos) > 0 THEN
    IF v_cat <> 'afro' THEN
      RAISE EXCEPTION 'A foto é aceita somente na categoria Afroempreendedores.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_limpos) s
      WHERE s->>'foto_path' IS NOT NULL AND coalesce(s->>'foto_autorizada', '') <> 'true'
    ) THEN
      RAISE EXCEPTION 'Confirme a autorização de uso de cada foto enviada.';
    END IF;
    IF (SELECT count(DISTINCT f) FROM unnest(v_fotos) f) <> cardinality(v_fotos) THEN
      RAISE EXCEPTION 'Cada sócio deve ter uma foto diferente.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_fotos) f
      WHERE f !~ '^fotos/[0-9a-f-]{36}\.(jpg|png)$'
         OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'maiores-melhores' AND o.name = f)
         OR public.mm_foto_em_uso(f)
    ) THEN
      RAISE EXCEPTION 'Não encontramos a foto enviada. Selecione a imagem novamente.';
    END IF;
  END IF;

  INSERT INTO public.mm_empresas (
    evento_id, participante_id, categoria, porte, razao_social, cnpj, responsavel,
    email, municipio, uf, socios, consentimento
  ) VALUES (
    v_evento, v_part, v_cat, v_porte, v_razao, v_cnpj, v_resp,
    v_email, v_mun, v_uf, v_limpos, TRUE
  )
  ON CONFLICT ON CONSTRAINT mm_empresas_cnpj_por_evento DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este CNPJ já foi inscrito nesta edição. Procure a organização se precisar corrigir a inscrição.';
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Sessão do participante (substitui a função da migration 34)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_sessao(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part   public.mm_participantes%ROWTYPE;
  v_evento UUID;
BEGIN
  SELECT * INTO v_part FROM public.mm_participantes WHERE id = public.mm_participante_id(p_token);
  SELECT id INTO v_evento FROM public.mm_eventos WHERE ativo LIMIT 1;

  RETURN jsonb_build_object(
    'participante', jsonb_build_object('nome', v_part.nome, 'email', v_part.email, 'telefone', v_part.telefone),
    'empresas', coalesce((
      SELECT jsonb_agg(
        (to_jsonb(e) - 'participante_id' - 'socios') || jsonb_build_object('socios', public.mm_socios_publicos(e.socios))
        ORDER BY e.criado_em DESC)
      FROM public.mm_empresas e
      WHERE e.participante_id = v_part.id AND e.evento_id = v_evento
    ), '[]'::jsonb),
    'negocios', coalesce((
      SELECT jsonb_agg(
        (to_jsonb(n) - 'token_hash' - 'revisado_por')
        ORDER BY n.data_emissao DESC, n.criado_em DESC)
      FROM public.mm_negocios n
      JOIN public.mm_empresas e ON e.id = n.empresa_id
      WHERE e.participante_id = v_part.id AND n.evento_id = v_evento
    ), '[]'::jsonb)
  );
END;
$$;
