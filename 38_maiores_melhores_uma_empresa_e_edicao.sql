-- Migration 38: Maiores & Melhores — uma empresa por participante e edição da inscrição
-- Diversidade.io — 2026
--
-- O que muda:
--  1. Cada participante pode ter UMA empresa inscrita por edição (índice único + checagem
--     amigável em mm_inscrever_empresa).
--  2. A inscrição pode ser alterada pelo próprio participante enquanto as inscrições estiverem
--     abertas (mm_atualizar_empresa). O CNPJ não muda. A categoria só muda enquanto a empresa
--     não tiver negócios registrados.
--  3. As validações de dados da empresa e dos sócios passam a viver em um só lugar
--     (mm_preparar_empresa), usado pela inscrição e pela edição.
--  4. Fotos: cada sócio pode manter a foto atual (foto_mantida = foto_id), trocar por uma nova
--     ou remover. mm_atualizar_empresa devolve os arquivos que deixaram de ser usados, para o
--     servidor apagá-los do armazenamento. A sessão do participante passa a trazer foto_id.
--
-- mm_atualizar_empresa só pode ser chamada pelo servidor (service_role), que apaga as fotos
-- removidas do bucket privado. Execute no SQL Editor do Supabase, depois das migrations 35 a 37.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Uma empresa por participante e edição
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.mm_empresas GROUP BY evento_id, participante_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Há participantes com mais de uma empresa inscrita na mesma edição. Resolva esses registros antes de aplicar a migration 38.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS mm_empresas_uma_por_participante ON public.mm_empresas (evento_id, participante_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Identificador opaco da foto (o caminho do arquivo nunca sai do servidor)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_foto_id(p_path TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT substr(public.mm_hash(p_path), 1, 16)
$$;

CREATE OR REPLACE FUNCTION public.mm_socios_publicos(p_socios JSONB)
RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'nome',       s.e->>'nome',
             'declaracao', s.e->>'declaracao',
             'tem_foto',   (s.e->>'foto_path') IS NOT NULL,
             'foto_id',    CASE WHEN (s.e->>'foto_path') IS NULL THEN NULL ELSE public.mm_foto_id(s.e->>'foto_path') END)
           ORDER BY s.n), '[]'::jsonb)
  FROM jsonb_array_elements(p_socios) WITH ORDINALITY AS s(e, n)
$$;

REVOKE EXECUTE ON FUNCTION public.mm_foto_id(TEXT) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Validação e limpeza dos dados da empresa (interna)
-- ───────────────────────────────────────────────────────────────────────────
-- p_atuais: sócios já gravados (vazio na inscrição). Um sócio pode referenciar a foto atual por
-- foto_mantida (foto_id) ou enviar uma foto nova por foto_path + foto_autorizada.
CREATE OR REPLACE FUNCTION public.mm_preparar_empresa(p_dados JSONB, p_atuais JSONB DEFAULT '[]'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat     TEXT := coalesce(p_dados->>'categoria', '');
  v_porte   TEXT := coalesce(p_dados->>'porte', '');
  v_razao   TEXT := btrim(coalesce(p_dados->>'razao_social', ''));
  v_resp    TEXT := btrim(coalesce(p_dados->>'responsavel', ''));
  v_email   TEXT := lower(btrim(coalesce(p_dados->>'email', '')));
  v_mun     TEXT := btrim(coalesce(p_dados->>'municipio', ''));
  v_uf      TEXT := upper(btrim(coalesce(p_dados->>'uf', '')));
  v_socios  JSONB := coalesce(p_dados->'socios', '[]'::jsonb);
  v_limpos  JSONB;
  v_fotos   TEXT[];
  v_antigas TEXT[];
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

  SELECT coalesce(array_agg(a.el->>'foto_path'), ARRAY[]::TEXT[])
    INTO v_antigas
  FROM jsonb_array_elements(coalesce(p_atuais, '[]'::jsonb)) AS a(el)
  WHERE a.el->>'foto_path' IS NOT NULL;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'nome',       btrim(coalesce(s.e->>'nome', '')),
             'declaracao', coalesce(s.e->>'declaracao', ''))
           || CASE
                -- foto nova (enviada agora)
                WHEN nullif(btrim(coalesce(s.e->>'foto_path', '')), '') IS NOT NULL
                THEN jsonb_build_object(
                       'foto_path',       btrim(s.e->>'foto_path'),
                       'foto_autorizada', (s.e->>'foto_autorizada') = 'true')
                -- foto atual mantida (referenciada pelo foto_id)
                WHEN nullif(btrim(coalesce(s.e->>'foto_mantida', '')), '') IS NOT NULL
                THEN coalesce(
                       (SELECT jsonb_build_object('foto_path', a.el->>'foto_path', 'foto_autorizada', TRUE)
                          FROM jsonb_array_elements(coalesce(p_atuais, '[]'::jsonb)) AS a(el)
                         WHERE a.el->>'foto_path' IS NOT NULL
                           AND public.mm_foto_id(a.el->>'foto_path') = btrim(s.e->>'foto_mantida')
                         LIMIT 1),
                       jsonb_build_object('foto_invalida', TRUE))
                ELSE '{}'::jsonb
              END
           ORDER BY s.n), '[]'::jsonb)
    INTO v_limpos
  FROM jsonb_array_elements(v_socios) WITH ORDINALITY AS s(e, n);

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_limpos) s WHERE s->>'foto_invalida' IS NOT NULL) THEN
    RAISE EXCEPTION 'Não encontramos a foto atual de um dos sócios. Atualize a página e tente novamente.';
  END IF;

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
    -- Só as fotos novas precisam existir no bucket e estar livres; as atuais já são da empresa.
    IF EXISTS (
      SELECT 1 FROM unnest(v_fotos) f
      WHERE NOT (f = ANY (v_antigas))
        AND (   f !~ '^fotos/[0-9a-f-]{36}\.(jpg|png)$'
             OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'maiores-melhores' AND o.name = f)
             OR public.mm_foto_em_uso(f))
    ) THEN
      RAISE EXCEPTION 'Não encontramos a foto enviada. Selecione a imagem novamente.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'categoria',    v_cat,
    'porte',        v_porte,
    'razao_social', v_razao,
    'responsavel',  v_resp,
    'email',        v_email,
    'municipio',    v_mun,
    'uf',           v_uf,
    'socios',       v_limpos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mm_preparar_empresa(JSONB, JSONB) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Inscrição (substitui a função da migration 35): uma empresa por participante
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_inscrever_empresa(p_token TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part   UUID := public.mm_participante_id(p_token);
  v_evento UUID := public.mm_evento_aberto_id();
  v_cnpj   TEXT := public.mm_normalizar_cnpj(p_dados->>'cnpj');
  v_dados  JSONB;
  v_id     UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.mm_empresas WHERE participante_id = v_part AND evento_id = v_evento) THEN
    RAISE EXCEPTION 'Você já inscreveu uma empresa nesta edição. Use “Editar inscrição” para corrigir os dados.';
  END IF;
  IF NOT public.mm_cnpj_valido(v_cnpj) THEN
    RAISE EXCEPTION 'Confira os 14 caracteres e os dígitos finais do CNPJ.';
  END IF;

  v_dados := public.mm_preparar_empresa(p_dados, '[]'::jsonb);

  INSERT INTO public.mm_empresas (
    evento_id, participante_id, categoria, porte, razao_social, cnpj, responsavel,
    email, municipio, uf, socios, consentimento
  ) VALUES (
    v_evento, v_part, v_dados->>'categoria', v_dados->>'porte', v_dados->>'razao_social', v_cnpj, v_dados->>'responsavel',
    v_dados->>'email', v_dados->>'municipio', v_dados->>'uf', v_dados->'socios', TRUE
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
-- 5. Edição da inscrição (somente o servidor, com service_role)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_atualizar_empresa(p_token TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part      UUID := public.mm_participante_id(p_token);
  v_evento    UUID := public.mm_evento_aberto_id();
  v_emp       RECORD;
  v_dados     JSONB;
  v_removidas JSONB;
BEGIN
  SELECT id, categoria, socios INTO v_emp
  FROM public.mm_empresas
  WHERE participante_id = v_part AND evento_id = v_evento
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não encontramos a sua inscrição nesta edição.';
  END IF;

  v_dados := public.mm_preparar_empresa(p_dados, v_emp.socios);

  IF v_dados->>'categoria' <> v_emp.categoria
     AND EXISTS (SELECT 1 FROM public.mm_negocios WHERE empresa_id = v_emp.id) THEN
    RAISE EXCEPTION 'Não é possível mudar a categoria depois de registrar negócios.';
  END IF;

  UPDATE public.mm_empresas
     SET categoria     = v_dados->>'categoria',
         porte         = v_dados->>'porte',
         razao_social  = v_dados->>'razao_social',
         responsavel   = v_dados->>'responsavel',
         email         = v_dados->>'email',
         municipio     = v_dados->>'municipio',
         uf            = v_dados->>'uf',
         socios        = v_dados->'socios',
         consentimento = TRUE
   WHERE id = v_emp.id;

  -- Arquivos que saíram da inscrição (foto trocada ou removida): o servidor os apaga do bucket.
  SELECT coalesce(jsonb_agg(x.caminho), '[]'::jsonb) INTO v_removidas
  FROM (
    SELECT el->>'foto_path' AS caminho FROM jsonb_array_elements(v_emp.socios) el WHERE el->>'foto_path' IS NOT NULL
    EXCEPT
    SELECT el->>'foto_path' FROM jsonb_array_elements(v_dados->'socios') el WHERE el->>'foto_path' IS NOT NULL
  ) x;

  RETURN jsonb_build_object('ok', TRUE, 'fotos_removidas', v_removidas);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mm_atualizar_empresa(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm_atualizar_empresa(TEXT, JSONB) TO service_role;
