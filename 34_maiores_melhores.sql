-- Migration 34: Módulo "Maiores & Melhores no Empreendedorismo Negro"
-- Diversidade.io — 2026
--
-- O que este script faz:
--  1. Cria as edições (eventos) da premiação, uma por ano, com período de inscrição
--  2. Cria participantes, empresas inscritas e negócios (notas fiscais) por edição
--  3. Aplica RLS: leitura e gestão completas só para administradores
--  4. Cria as RPCs SECURITY DEFINER usadas pela página pública /maiores-e-melhores
--     e pela confirmação do comprador /maiores-e-melhores/confirmar
--  5. Cria o bucket privado "maiores-melhores" para as fotos opcionais
--
-- Regras de negócio portadas do pacote Maiores_Melhores_v13 (app/api/premiacao/route.ts).
--
-- Participantes não precisam de conta na plataforma: ao informar nome, e-mail e
-- telefone recebem um token de sessão guardado no navegador (válido por 180 dias).
-- Toda escrita pública passa pelas RPCs abaixo, que validam esse token.
--
-- Execute no SQL Editor do Supabase.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Tabelas
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mm_eventos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ano              INT         NOT NULL UNIQUE CHECK (ano BETWEEN 2020 AND 2100),
  titulo           TEXT        NOT NULL DEFAULT 'Maiores & Melhores no Empreendedorismo Negro',
  descricao        TEXT,
  inicio_cadastro  DATE        NOT NULL,
  fim_cadastro     DATE        NOT NULL,
  ativo            BOOLEAN     NOT NULL DEFAULT FALSE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mm_eventos_periodo CHECK (fim_cadastro >= inicio_cadastro)
);

COMMENT ON TABLE  public.mm_eventos IS 'Edições anuais da premiação Maiores & Melhores';
COMMENT ON COLUMN public.mm_eventos.ativo IS 'Somente uma edição pode estar ativa. A página pública usa a edição ativa.';

-- Garante no máximo uma edição ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS mm_eventos_um_ativo ON public.mm_eventos ((ativo)) WHERE ativo;

DROP TRIGGER IF EXISTS trigger_mm_eventos_atualizado_em ON public.mm_eventos;
CREATE TRIGGER trigger_mm_eventos_atualizado_em
  BEFORE UPDATE ON public.mm_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE IF NOT EXISTS public.mm_participantes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id    UUID        REFERENCES public.mm_eventos(id) ON DELETE SET NULL,
  nome         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  telefone     TEXT        NOT NULL,
  sessao_hash  TEXT        NOT NULL UNIQUE,
  expira_em    TIMESTAMPTZ NOT NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.mm_participantes.evento_id IS 'Edição ativa no momento do primeiro acesso';
COMMENT ON COLUMN public.mm_participantes.sessao_hash IS 'SHA-256 do token guardado no navegador do participante';

CREATE INDEX IF NOT EXISTS idx_mm_participantes_evento ON public.mm_participantes (evento_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.mm_empresas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id        UUID        NOT NULL REFERENCES public.mm_eventos(id) ON DELETE RESTRICT,
  participante_id  UUID        NOT NULL REFERENCES public.mm_participantes(id) ON DELETE RESTRICT,
  categoria        TEXT        NOT NULL CHECK (categoria IN ('afro', 'inclusiva')),
  porte            TEXT        NOT NULL CHECK (porte IN ('MEI', 'Micro', 'Pequena', 'Média', 'Grande')),
  razao_social     TEXT        NOT NULL,
  cnpj             TEXT        NOT NULL CHECK (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  responsavel      TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  municipio        TEXT        NOT NULL,
  uf               TEXT        NOT NULL,
  socios           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  foto_path        TEXT,
  consentimento    BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mm_empresas_cnpj_por_evento UNIQUE (evento_id, cnpj),
  CONSTRAINT mm_empresas_porte_inclusiva CHECK (categoria <> 'inclusiva' OR porte IN ('Média', 'Grande'))
);

CREATE INDEX IF NOT EXISTS idx_mm_empresas_participante ON public.mm_empresas (participante_id);
CREATE UNIQUE INDEX IF NOT EXISTS mm_empresas_foto_unica ON public.mm_empresas (foto_path) WHERE foto_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mm_negocios (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id              UUID        NOT NULL REFERENCES public.mm_eventos(id) ON DELETE RESTRICT,
  empresa_id             UUID        NOT NULL REFERENCES public.mm_empresas(id) ON DELETE CASCADE,
  perfil_parceiro        TEXT        NOT NULL CHECK (perfil_parceiro IN ('afro', 'media', 'grande')),
  cnpj_comprador         TEXT        NOT NULL,
  cnpj_vendedor          TEXT        NOT NULL,
  cnpj_parceiro          TEXT        NOT NULL,
  razao_social_parceiro  TEXT        NOT NULL,
  data_emissao           DATE        NOT NULL,
  valor_centavos         BIGINT      NOT NULL CHECK (valor_centavos > 0),
  numero_nota            TEXT        NOT NULL,
  serie_nota             TEXT        NOT NULL DEFAULT '',
  email_comprador        TEXT        NOT NULL,
  whatsapp_comprador     TEXT,
  token_hash             TEXT        UNIQUE,
  token_expira_em        TIMESTAMPTZ,
  resposta_comprador     TEXT        CHECK (resposta_comprador IN ('confirmado', 'divergencia', 'desconhecido')),
  observacao_comprador   TEXT,
  respondido_em          TIMESTAMPTZ,
  status                 TEXT        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'validado', 'indeferido')),
  motivo                 TEXT        NOT NULL DEFAULT '',
  revisado_por           TEXT,
  revisado_em            TIMESTAMPTZ,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mm_negocios_nota_por_empresa UNIQUE (empresa_id, cnpj_vendedor, numero_nota, serie_nota)
);

CREATE INDEX IF NOT EXISTS idx_mm_negocios_evento_status ON public.mm_negocios (evento_id, status, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_mm_negocios_empresa ON public.mm_negocios (empresa_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. RLS — somente administradores leem/gerenciam diretamente.
--    Participantes e compradores usam exclusivamente as RPCs abaixo.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mm_eventos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_empresas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_negocios      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mm_eventos_adm" ON public.mm_eventos;
CREATE POLICY "mm_eventos_adm" ON public.mm_eventos
  FOR ALL TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "mm_participantes_adm_ler" ON public.mm_participantes;
CREATE POLICY "mm_participantes_adm_ler" ON public.mm_participantes
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

DROP POLICY IF EXISTS "mm_empresas_adm_ler" ON public.mm_empresas;
CREATE POLICY "mm_empresas_adm_ler" ON public.mm_empresas
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

DROP POLICY IF EXISTS "mm_empresas_adm_excluir" ON public.mm_empresas;
CREATE POLICY "mm_empresas_adm_excluir" ON public.mm_empresas
  FOR DELETE TO authenticated
  USING (public.is_system_admin());

DROP POLICY IF EXISTS "mm_negocios_adm_ler" ON public.mm_negocios;
CREATE POLICY "mm_negocios_adm_ler" ON public.mm_negocios
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Funções auxiliares (internas)
-- ───────────────────────────────────────────────────────────────────────────

-- Data de hoje no fuso de São Paulo
CREATE OR REPLACE FUNCTION public.mm_hoje()
RETURNS DATE
LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;

CREATE OR REPLACE FUNCTION public.mm_hash(p_valor TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(p_valor, 'UTF8')), 'hex')
$$;

-- Token de 64 caracteres hexadecimais (2 UUIDs v4 = 244 bits aleatórios)
CREATE OR REPLACE FUNCTION public.mm_novo_token()
RETURNS TEXT
LANGUAGE sql VOLATILE AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

CREATE OR REPLACE FUNCTION public.mm_normalizar_cnpj(p_cnpj TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(regexp_replace(coalesce(p_cnpj, ''), '[./[:space:]-]', '', 'g'))
$$;

-- Valida CNPJ numérico e alfanumérico (regra da Receita Federal a partir de 2026)
CREATE OR REPLACE FUNCTION public.mm_cnpj_valido(p_cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s      TEXT := public.mm_normalizar_cnpj(p_cnpj);
  n      INT;
  i      INT;
  soma   INT;
  dv     INT;
BEGIN
  IF s !~ '^[A-Z0-9]{12}[0-9]{2}$' OR s ~ '^(.)\1+$' THEN
    RETURN FALSE;
  END IF;
  FOREACH n IN ARRAY ARRAY[12, 13] LOOP
    soma := 0;
    FOR i IN 0..n - 1 LOOP
      soma := soma + (ascii(substr(s, i + 1, 1)) - 48) * (((n - i - 1) % 8) + 2);
    END LOOP;
    dv := CASE WHEN soma % 11 < 2 THEN 0 ELSE 11 - soma % 11 END;
    IF dv <> ascii(substr(s, n + 1, 1)) - 48 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_email_valido(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p_email, '') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND length(p_email) <= 180
$$;

-- Edição com inscrições abertas hoje; erro amigável se não houver
CREATE OR REPLACE FUNCTION public.mm_evento_aberto_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.mm_eventos
  WHERE ativo AND public.mm_hoje() BETWEEN inicio_cadastro AND fim_cadastro
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'As inscrições do Maiores & Melhores não estão abertas no momento.';
  END IF;
  RETURN v_id;
END;
$$;

-- Resolve o participante pelo token. ERRCODE 28000 sinaliza ao front que a sessão caiu.
CREATE OR REPLACE FUNCTION public.mm_participante_id(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Sua sessão expirou. Informe seus dados para continuar.' USING ERRCODE = '28000';
  END IF;

  SELECT id INTO v_id
  FROM public.mm_participantes
  WHERE sessao_hash = public.mm_hash(p_token) AND expira_em > now();

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Informe seus dados para continuar.' USING ERRCODE = '28000';
  END IF;
  RETURN v_id;
END;
$$;

-- Usada pela política de upload de fotos (anon não lê mm_eventos diretamente)
CREATE OR REPLACE FUNCTION public.mm_inscricoes_abertas()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mm_eventos
    WHERE ativo AND public.mm_hoje() BETWEEN inicio_cadastro AND fim_cadastro
  )
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RPCs públicas — página /maiores-e-melhores
-- ───────────────────────────────────────────────────────────────────────────

-- Edição ativa (ou NULL). "aberto" indica se hoje está dentro do período.
CREATE OR REPLACE FUNCTION public.mm_evento_atual()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id',              id,
    'ano',             ano,
    'titulo',          titulo,
    'descricao',       descricao,
    'inicio_cadastro', inicio_cadastro,
    'fim_cadastro',    fim_cadastro,
    'aberto',          public.mm_hoje() BETWEEN inicio_cadastro AND fim_cadastro
  )
  FROM public.mm_eventos
  WHERE ativo
  LIMIT 1
$$;

-- Primeiro acesso: cria o participante e devolve o token de sessão
CREATE OR REPLACE FUNCTION public.mm_entrar(p_nome TEXT, p_email TEXT, p_telefone TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evento UUID := public.mm_evento_aberto_id();
  v_nome   TEXT := btrim(coalesce(p_nome, ''));
  v_email  TEXT := lower(btrim(coalesce(p_email, '')));
  v_tel    TEXT := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_token  TEXT := public.mm_novo_token();
BEGIN
  IF length(v_nome) NOT BETWEEN 2 AND 180
     OR NOT public.mm_email_valido(v_email)
     OR coalesce(p_telefone, '') !~ '^[+0-9 ().-]*$'
     OR length(v_tel) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION 'Confira o nome, o e-mail e o telefone com DDD.';
  END IF;

  INSERT INTO public.mm_participantes (evento_id, nome, email, telefone, sessao_hash, expira_em)
  VALUES (v_evento, v_nome, v_email, v_tel, public.mm_hash(v_token), now() + interval '180 days');

  RETURN jsonb_build_object('token', v_token, 'nome', v_nome, 'email', v_email);
END;
$$;

-- Dados do participante: inscrições e negócios na edição ativa
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
        (to_jsonb(e) - 'participante_id' - 'foto_path') || jsonb_build_object('tem_foto', e.foto_path IS NOT NULL)
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

-- Verifica se um CNPJ já está inscrito na edição aberta
CREATE OR REPLACE FUNCTION public.mm_consultar_cnpj(p_token TEXT, p_cnpj TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part   UUID := public.mm_participante_id(p_token);
  v_evento UUID := public.mm_evento_aberto_id();
  v_id     UUID;
  v_dono   UUID;
BEGIN
  IF NOT public.mm_cnpj_valido(p_cnpj) THEN
    RAISE EXCEPTION 'Confira os 14 caracteres e os dígitos finais do CNPJ.';
  END IF;

  SELECT id, participante_id INTO v_id, v_dono
  FROM public.mm_empresas
  WHERE evento_id = v_evento AND cnpj = public.mm_normalizar_cnpj(p_cnpj);

  RETURN jsonb_build_object(
    'registrada', v_id IS NOT NULL,
    'empresa_id', CASE WHEN v_dono = v_part THEN v_id END
  );
END;
$$;

-- Inscrição da empresa
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
  v_foto    TEXT := nullif(btrim(coalesce(p_dados->>'foto_path', '')), '');
  v_limpos  JSONB;
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

  IF jsonb_typeof(v_socios) <> 'array' THEN
    RAISE EXCEPTION 'Confira a lista de sócios e titulares.';
  END IF;
  IF jsonb_array_length(v_socios) > 100 THEN
    RAISE EXCEPTION 'Informe até 100 sócios ou titulares.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'nome',       btrim(coalesce(s->>'nome', '')),
           'declaracao', coalesce(s->>'declaracao', ''))), '[]'::jsonb)
    INTO v_limpos
  FROM jsonb_array_elements(v_socios) s;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_limpos) s
    WHERE length(s->>'nome') NOT BETWEEN 2 AND 180
       OR s->>'declaracao' NOT IN ('preta_parda', 'outra', 'nao_informada')
  ) THEN
    RAISE EXCEPTION 'Confira o nome e a autodeclaração de cada sócio ou titular.';
  END IF;

  IF v_cat = 'afro' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_limpos) s WHERE s->>'declaracao' = 'preta_parda'
  ) THEN
    RAISE EXCEPTION 'Informe pelo menos um sócio ou titular com autodeclaração preta ou parda.';
  END IF;

  IF v_foto IS NOT NULL THEN
    IF v_cat <> 'afro' THEN
      RAISE EXCEPTION 'A foto é aceita somente na categoria Afroempreendedores.';
    END IF;
    IF v_foto !~ '^fotos/[0-9a-f-]{36}\.(jpg|png)$'
       OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'maiores-melhores' AND name = v_foto)
       OR EXISTS (SELECT 1 FROM public.mm_empresas WHERE foto_path = v_foto) THEN
      RAISE EXCEPTION 'Não encontramos a foto enviada. Selecione a imagem novamente.';
    END IF;
  END IF;

  INSERT INTO public.mm_empresas (
    evento_id, participante_id, categoria, porte, razao_social, cnpj, responsavel,
    email, municipio, uf, socios, foto_path, consentimento
  ) VALUES (
    v_evento, v_part, v_cat, v_porte, v_razao, v_cnpj, v_resp,
    v_email, v_mun, v_uf, v_limpos, v_foto, TRUE
  )
  ON CONFLICT ON CONSTRAINT mm_empresas_cnpj_por_evento DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este CNPJ já foi inscrito nesta edição. Procure a organização se precisar corrigir a inscrição.';
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- Registro de negócio (nota fiscal) e geração do link de confirmação do comprador
CREATE OR REPLACE FUNCTION public.mm_registrar_negocio(p_token TEXT, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part      public.mm_participantes%ROWTYPE;
  v_evento    UUID := public.mm_evento_aberto_id();
  v_emp       public.mm_empresas%ROWTYPE;
  v_perfil    TEXT := coalesce(p_dados->>'perfil_parceiro', '');
  v_comprador TEXT := public.mm_normalizar_cnpj(p_dados->>'cnpj_comprador');
  v_vendedor  TEXT := public.mm_normalizar_cnpj(p_dados->>'cnpj_vendedor');
  v_parceiro  TEXT;
  v_razao     TEXT := btrim(coalesce(p_dados->>'razao_social_parceiro', ''));
  v_data_txt  TEXT := coalesce(p_dados->>'data_emissao', '');
  v_data      DATE;
  v_valor_txt TEXT := coalesce(p_dados->>'valor_centavos', '');
  v_valor     BIGINT;
  v_numero    TEXT := btrim(coalesce(p_dados->>'numero_nota', ''));
  v_serie     TEXT := upper(btrim(coalesce(p_dados->>'serie_nota', '')));
  v_email     TEXT := lower(btrim(coalesce(p_dados->>'email_comprador', '')));
  v_whats_txt TEXT := btrim(coalesce(p_dados->>'whatsapp_comprador', ''));
  v_whats     TEXT;
  v_token     TEXT := public.mm_novo_token();
  v_id        UUID;
BEGIN
  SELECT * INTO v_part FROM public.mm_participantes WHERE id = public.mm_participante_id(p_token);

  IF coalesce(p_dados->>'empresa_id', '') !~ '^[0-9a-f-]{36}$' THEN
    RAISE EXCEPTION 'Selecione novamente a empresa inscrita.';
  END IF;
  SELECT * INTO v_emp
  FROM public.mm_empresas
  WHERE id = (p_dados->>'empresa_id')::uuid AND participante_id = v_part.id AND evento_id = v_evento;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada nesta edição.';
  END IF;

  IF v_perfil NOT IN ('afro', 'media', 'grande') THEN
    RAISE EXCEPTION 'Confira o perfil da empresa parceira.';
  END IF;
  IF NOT public.mm_cnpj_valido(v_comprador) THEN
    RAISE EXCEPTION 'Confira o CNPJ da empresa compradora.';
  END IF;
  IF NOT public.mm_cnpj_valido(v_vendedor) THEN
    RAISE EXCEPTION 'Confira o CNPJ da empresa vendedora.';
  END IF;
  IF v_comprador = v_vendedor OR v_emp.cnpj NOT IN (v_comprador, v_vendedor) THEN
    RAISE EXCEPTION 'Informe dois CNPJs diferentes. Um deve corresponder ao CNPJ da inscrição.';
  END IF;
  IF v_emp.categoria = 'inclusiva' AND v_comprador <> v_emp.cnpj THEN
    RAISE EXCEPTION 'Nesta categoria, a empresa inscrita deve ser a compradora.';
  END IF;
  IF v_emp.categoria = 'inclusiva' AND v_perfil <> 'afro' THEN
    RAISE EXCEPTION 'Informe uma empresa parceira liderada por pessoas negras.';
  END IF;
  IF v_perfil <> 'afro' AND v_vendedor <> v_emp.cnpj THEN
    RAISE EXCEPTION 'Para negócios com empresas inclusivas, a empresa inscrita deve ser a vendedora.';
  END IF;
  v_parceiro := CASE WHEN v_comprador = v_emp.cnpj THEN v_vendedor ELSE v_comprador END;

  IF length(v_razao) NOT BETWEEN 2 AND 180 THEN
    RAISE EXCEPTION 'Informe a razão social da empresa parceira.';
  END IF;

  IF v_data_txt !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Informe uma data de emissão válida.';
  END IF;
  BEGIN
    v_data := v_data_txt::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Informe uma data de emissão válida.';
  END;
  IF v_data > public.mm_hoje() THEN
    RAISE EXCEPTION 'Informe uma data de emissão até hoje.';
  END IF;

  IF v_valor_txt !~ '^\d{1,15}$' THEN
    RAISE EXCEPTION 'Informe um valor da nota maior que zero. Exemplo: 1500,00.';
  END IF;
  v_valor := v_valor_txt::bigint;
  IF v_valor <= 0 OR v_valor > 100000000000000 THEN
    RAISE EXCEPTION 'Informe um valor da nota maior que zero. Exemplo: 1500,00.';
  END IF;

  IF v_numero !~ '^\d{1,15}$' THEN
    RAISE EXCEPTION 'Informe o número da nota com 1 a 15 algarismos.';
  END IF;
  v_numero := regexp_replace(v_numero, '^0+(?=\d)', '');

  IF v_serie !~ '^[A-Z0-9-]{0,12}$' THEN
    RAISE EXCEPTION 'Use até 12 letras, números ou hífens na série da nota.';
  END IF;
  v_serie := regexp_replace(v_serie, '^0+(?=\d)', '');

  IF NOT public.mm_email_valido(v_email) THEN
    RAISE EXCEPTION 'Confira o e-mail do comprador.';
  END IF;
  IF v_email = lower(v_part.email) OR (v_comprador = v_emp.cnpj AND v_email = lower(v_emp.email)) THEN
    RAISE EXCEPTION 'Informe o e-mail de outro representante da compradora para confirmar a nota.';
  END IF;

  IF v_whats_txt <> '' THEN
    v_whats := regexp_replace(v_whats_txt, '[^0-9]', '', 'g');
    IF v_whats_txt !~ '^[+0-9 ()-]+$' OR length(v_whats) NOT BETWEEN 10 AND 15 THEN
      RAISE EXCEPTION 'Confira o WhatsApp com DDD ou deixe o campo em branco.';
    END IF;
  END IF;

  INSERT INTO public.mm_negocios (
    evento_id, empresa_id, perfil_parceiro, cnpj_comprador, cnpj_vendedor, cnpj_parceiro,
    razao_social_parceiro, data_emissao, valor_centavos, numero_nota, serie_nota,
    email_comprador, whatsapp_comprador, token_hash, token_expira_em
  ) VALUES (
    v_evento, v_emp.id, v_perfil, v_comprador, v_vendedor, v_parceiro,
    v_razao, v_data, v_valor, v_numero, v_serie,
    v_email, v_whats, public.mm_hash(v_token), now() + interval '7 days'
  )
  ON CONFLICT ON CONSTRAINT mm_negocios_nota_por_empresa DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Já existe um lançamento correspondente. Confira o número e a série da nota.';
  END IF;

  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$$;

-- Gera um novo link de confirmação (o anterior deixa de valer)
CREATE OR REPLACE FUNCTION public.mm_renovar_link(p_token TEXT, p_negocio_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part  UUID := public.mm_participante_id(p_token);
  v_token TEXT := public.mm_novo_token();
  v_id    UUID;
BEGIN
  UPDATE public.mm_negocios n
     SET token_hash = public.mm_hash(v_token),
         token_expira_em = now() + interval '7 days'
    FROM public.mm_empresas e
   WHERE n.id = p_negocio_id
     AND e.id = n.empresa_id
     AND e.participante_id = v_part
     AND n.status = 'pendente'
     AND n.resposta_comprador IS NULL
  RETURNING n.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este lançamento não tem uma confirmação pendente que possa ser renovada.';
  END IF;

  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RPCs públicas — confirmação do comprador (/maiores-e-melhores/confirmar#token)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_confirmacao_obter(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v RECORD;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou foi substituído. Solicite um novo link à empresa que enviou a nota.';
  END IF;

  SELECT e.razao_social, e.cnpj, n.cnpj_comprador, n.cnpj_vendedor, n.razao_social_parceiro,
         n.numero_nota, n.serie_nota, n.data_emissao, n.valor_centavos
    INTO v
  FROM public.mm_negocios n
  JOIN public.mm_empresas e ON e.id = n.empresa_id
  WHERE n.token_hash = public.mm_hash(p_token)
    AND n.token_expira_em > now()
    AND n.resposta_comprador IS NULL
    AND n.status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou foi substituído. Solicite um novo link à empresa que enviou a nota.';
  END IF;

  RETURN jsonb_build_object(
    'compradora',      CASE WHEN v.cnpj = v.cnpj_comprador THEN v.razao_social ELSE v.razao_social_parceiro END,
    'vendedora',       CASE WHEN v.cnpj = v.cnpj_comprador THEN v.razao_social_parceiro ELSE v.razao_social END,
    'cnpj_comprador',  v.cnpj_comprador,
    'cnpj_vendedor',   v.cnpj_vendedor,
    'numero_nota',     v.numero_nota,
    'serie_nota',      v.serie_nota,
    'data_emissao',    v.data_emissao,
    'valor_centavos',  v.valor_centavos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_confirmacao_responder(p_token TEXT, p_resposta TEXT, p_observacao TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obs TEXT := nullif(btrim(coalesce(p_observacao, '')), '');
  v_id  UUID;
BEGIN
  IF p_resposta IS NULL OR p_resposta NOT IN ('confirmado', 'divergencia', 'desconhecido') THEN
    RAISE EXCEPTION 'Selecione uma resposta.';
  END IF;
  IF p_resposta = 'divergencia' AND v_obs IS NULL THEN
    RAISE EXCEPTION 'Descreva a divergência encontrada.';
  END IF;
  IF length(coalesce(v_obs, '')) > 350 THEN
    RAISE EXCEPTION 'Use até 350 caracteres na observação.';
  END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou foi substituído. Solicite um novo link à empresa que enviou a nota.';
  END IF;

  UPDATE public.mm_negocios
     SET resposta_comprador   = p_resposta,
         observacao_comprador = CASE WHEN p_resposta = 'confirmado' THEN NULL ELSE v_obs END,
         respondido_em        = now(),
         token_hash           = NULL
   WHERE token_hash = public.mm_hash(p_token)
     AND token_expira_em > now()
     AND resposta_comprador IS NULL
     AND status = 'pendente'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou foi substituído. Solicite um novo link à empresa que enviou a nota.';
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. RPCs administrativas
-- ───────────────────────────────────────────────────────────────────────────

-- Ativa uma edição (desativando as demais) ou desativa
CREATE OR REPLACE FUNCTION public.mm_definir_evento_ativo(p_id UUID, p_ativo BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração.' USING ERRCODE = '42501';
  END IF;
  IF p_ativo THEN
    UPDATE public.mm_eventos SET ativo = FALSE WHERE ativo AND id <> p_id;
  END IF;
  UPDATE public.mm_eventos SET ativo = p_ativo WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edição não encontrada.';
  END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- Validação / indeferimento de negócio
CREATE OR REPLACE FUNCTION public.mm_revisar_negocio(p_id UUID, p_status TEXT, p_motivo TEXT, p_status_anterior TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_motivo TEXT := btrim(coalesce(p_motivo, ''));
  v        public.mm_negocios%ROWTYPE;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pendente', 'validado', 'indeferido') THEN
    RAISE EXCEPTION 'Situação inválida.';
  END IF;
  IF p_status = 'indeferido' AND v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo do indeferimento.';
  END IF;
  IF length(v_motivo) > 350 THEN
    RAISE EXCEPTION 'Use até 350 caracteres no motivo.';
  END IF;

  SELECT * INTO v FROM public.mm_negocios WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negócio não encontrado.';
  END IF;
  IF v.status IS DISTINCT FROM p_status_anterior THEN
    RAISE EXCEPTION 'Este negócio foi atualizado em outra tela. Atualize a página e tente novamente.';
  END IF;

  IF p_status = 'validado' THEN
    IF v.resposta_comprador IS DISTINCT FROM 'confirmado' THEN
      RAISE EXCEPTION 'Só é possível validar depois que o comprador confirmar a nota.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.mm_negocios o
      WHERE o.id <> v.id
        AND o.evento_id = v.evento_id
        AND o.status = 'validado'
        AND o.cnpj_vendedor = v.cnpj_vendedor
        AND o.numero_nota = v.numero_nota
        AND o.serie_nota = v.serie_nota
        AND (o.cnpj_comprador <> v.cnpj_comprador OR o.data_emissao <> v.data_emissao OR o.valor_centavos <> v.valor_centavos)
    ) THEN
      RAISE EXCEPTION 'Já existe uma nota validada com o mesmo número e série, mas com dados diferentes.';
    END IF;
  END IF;

  UPDATE public.mm_negocios
     SET status       = p_status,
         motivo       = CASE WHEN p_status = 'indeferido' THEN v_motivo ELSE '' END,
         revisado_por = coalesce(auth.jwt() ->> 'email', ''),
         revisado_em  = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Permissões das funções
-- ───────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.mm_evento_aberto_id()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_participante_id(TEXT)   FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mm_evento_atual()                              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_inscricoes_abertas()                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_entrar(TEXT, TEXT, TEXT)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_sessao(TEXT)                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_consultar_cnpj(TEXT, TEXT)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_inscrever_empresa(TEXT, JSONB)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_registrar_negocio(TEXT, JSONB)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_renovar_link(TEXT, UUID)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_confirmacao_obter(TEXT)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_confirmacao_responder(TEXT, TEXT, TEXT)     TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mm_definir_evento_ativo(UUID, BOOLEAN)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mm_revisar_negocio(UUID, TEXT, TEXT, TEXT)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mm_definir_evento_ativo(UUID, BOOLEAN)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.mm_revisar_negocio(UUID, TEXT, TEXT, TEXT)    TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Storage — fotos opcionais (privadas, só a administração visualiza)
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('maiores-melhores', 'maiores-melhores', FALSE, 4194304, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Upload anônimo apenas na pasta fotos/, com nome UUID, enquanto as inscrições estiverem abertas
DROP POLICY IF EXISTS "mm_fotos_enviar" ON storage.objects;
CREATE POLICY "mm_fotos_enviar" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'maiores-melhores'
    AND name ~ '^fotos/[0-9a-f-]{36}\.(jpg|png)$'
    AND public.mm_inscricoes_abertas()
  );

DROP POLICY IF EXISTS "mm_fotos_adm_ler" ON storage.objects;
CREATE POLICY "mm_fotos_adm_ler" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'maiores-melhores' AND public.is_system_admin());

DROP POLICY IF EXISTS "mm_fotos_adm_excluir" ON storage.objects;
CREATE POLICY "mm_fotos_adm_excluir" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'maiores-melhores' AND public.is_system_admin());
