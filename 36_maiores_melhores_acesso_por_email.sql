-- Migration 36: Maiores & Melhores — recuperar o acesso à inscrição por e-mail
-- Diversidade.io — 2026
--
-- Problema: o participante é identificado por um token guardado no navegador. Quem troca de
-- navegador, limpa os dados do site ou muda de computador perdia o acesso à própria inscrição.
--
-- Solução: informando só o CNPJ já inscrito, a pessoa recebe um link por e-mail. O link é de uso
-- único, vale 30 minutos e abre uma nova sessão para o mesmo participante.
--
-- O que este script faz:
--  1. Cria mm_sessoes: um participante passa a poder ter várias sessões (um navegador cada).
--     As sessões que já existem são copiadas e as colunas antigas saem de mm_participantes.
--  2. Cria mm_acessos: links de acesso enviados por e-mail (guarda só o hash do token).
--  3. mm_acesso_solicitar: usada somente pelo servidor (service_role). Valida o CNPJ, aplica o
--     limite de envios e devolve os destinatários e o token do link.
--  4. mm_acesso_confirmar: usada pela página do link. Consome o token e devolve a nova sessão.
--  5. Atualiza mm_entrar, mm_participante_id e mm_sessao para usar mm_sessoes.
--
-- Execute no SQL Editor do Supabase depois da migration 35.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Sessões do participante (uma por navegador)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mm_sessoes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id  UUID        NOT NULL REFERENCES public.mm_participantes(id) ON DELETE CASCADE,
  sessao_hash      TEXT        NOT NULL UNIQUE,
  expira_em        TIMESTAMPTZ NOT NULL,
  origem           TEXT        NOT NULL DEFAULT 'primeiro_acesso' CHECK (origem IN ('primeiro_acesso', 'link_email')),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.mm_sessoes IS 'Sessões dos participantes: uma linha por navegador. Guarda só o SHA-256 do token.';
CREATE INDEX IF NOT EXISTS idx_mm_sessoes_participante ON public.mm_sessoes (participante_id);

ALTER TABLE public.mm_sessoes ENABLE ROW LEVEL SECURITY;  -- sem políticas: só as funções SECURITY DEFINER acessam

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mm_participantes' AND column_name = 'sessao_hash'
  ) THEN
    INSERT INTO public.mm_sessoes (participante_id, sessao_hash, expira_em)
    SELECT id, sessao_hash, expira_em FROM public.mm_participantes
    ON CONFLICT (sessao_hash) DO NOTHING;

    ALTER TABLE public.mm_participantes DROP COLUMN sessao_hash, DROP COLUMN expira_em;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Links de acesso enviados por e-mail
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mm_acessos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id  UUID        NOT NULL REFERENCES public.mm_participantes(id) ON DELETE CASCADE,
  empresa_id       UUID        REFERENCES public.mm_empresas(id) ON DELETE CASCADE,
  token_hash       TEXT        NOT NULL UNIQUE,
  expira_em        TIMESTAMPTZ NOT NULL,
  usado_em         TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mm_acessos IS 'Links de recuperação de acesso enviados por e-mail: uso único, 30 minutos.';
CREATE INDEX IF NOT EXISTS idx_mm_acessos_participante ON public.mm_acessos (participante_id, criado_em DESC);

ALTER TABLE public.mm_acessos ENABLE ROW LEVEL SECURITY;  -- sem políticas

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Funções existentes que passam a usar mm_sessoes
-- ───────────────────────────────────────────────────────────────────────────

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

  SELECT participante_id INTO v_id
  FROM public.mm_sessoes
  WHERE sessao_hash = public.mm_hash(p_token) AND expira_em > now();

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Informe seus dados para continuar.' USING ERRCODE = '28000';
  END IF;
  RETURN v_id;
END;
$$;

-- Primeiro acesso: cria o participante e a primeira sessão
CREATE OR REPLACE FUNCTION public.mm_entrar(p_nome TEXT, p_email TEXT, p_telefone TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evento UUID := public.mm_evento_aberto_id();
  v_nome   TEXT := btrim(coalesce(p_nome, ''));
  v_email  TEXT := lower(btrim(coalesce(p_email, '')));
  v_tel    TEXT := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_token  TEXT := public.mm_novo_token();
  v_id     UUID;
BEGIN
  IF length(v_nome) NOT BETWEEN 2 AND 180
     OR NOT public.mm_email_valido(v_email)
     OR coalesce(p_telefone, '') !~ '^[+0-9 ().-]*$'
     OR length(v_tel) NOT BETWEEN 10 AND 15 THEN
    RAISE EXCEPTION 'Confira o nome, o e-mail e o telefone com DDD.';
  END IF;

  INSERT INTO public.mm_participantes (evento_id, nome, email, telefone)
  VALUES (v_evento, v_nome, v_email, v_tel)
  RETURNING id INTO v_id;

  INSERT INTO public.mm_sessoes (participante_id, sessao_hash, expira_em, origem)
  VALUES (v_id, public.mm_hash(v_token), now() + interval '180 days', 'primeiro_acesso');

  RETURN jsonb_build_object('token', v_token, 'nome', v_nome, 'email', v_email);
END;
$$;

-- Dados do participante: inscrições e negócios na edição ativa
CREATE OR REPLACE FUNCTION public.mm_sessao(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part   RECORD;
  v_evento UUID;
BEGIN
  SELECT p.id, p.nome, p.email, p.telefone INTO v_part
  FROM public.mm_participantes p
  WHERE p.id = public.mm_participante_id(p_token);
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

-- Funções que declaram variáveis com %ROWTYPE das tabelas alteradas (mm_participantes na 36,
-- mm_empresas na 35) são recriadas a partir da própria definição. Sem isso, conexões que já
-- haviam carregado a função podem manter o formato antigo da tabela até reconectar.
DO $$
BEGIN
  EXECUTE pg_get_functiondef('public.mm_registrar_negocio(text,jsonb)'::regprocedure);
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Pedido do link de acesso (somente o servidor, com service_role)
-- ───────────────────────────────────────────────────────────────────────────
-- Devolve NULL quando não há inscrição para o CNPJ e {"limitado": true} quando o limite de envios
-- foi atingido. O servidor responde sempre a mesma coisa nos dois casos, para não revelar
-- quais CNPJs estão inscritos.
CREATE OR REPLACE FUNCTION public.mm_acesso_solicitar(p_cnpj TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cnpj   TEXT := public.mm_normalizar_cnpj(p_cnpj);
  v_evento UUID;
  v_emp    RECORD;
  v_part   RECORD;
  v_token  TEXT;
  v_emails JSONB;
BEGIN
  IF NOT public.mm_cnpj_valido(v_cnpj) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_evento FROM public.mm_eventos WHERE ativo LIMIT 1;
  IF v_evento IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT e.id, e.razao_social, e.email, e.participante_id INTO v_emp
  FROM public.mm_empresas e
  WHERE e.evento_id = v_evento AND e.cnpj = v_cnpj;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT p.id, p.nome, p.email INTO v_part FROM public.mm_participantes p WHERE p.id = v_emp.participante_id;

  -- Limpeza de links antigos
  DELETE FROM public.mm_acessos WHERE criado_em < now() - interval '7 days';

  -- No máximo 1 pedido por minuto e 5 por hora para cada participante
  IF EXISTS (SELECT 1 FROM public.mm_acessos WHERE participante_id = v_part.id AND criado_em > now() - interval '1 minute')
     OR (SELECT count(*) FROM public.mm_acessos WHERE participante_id = v_part.id AND criado_em > now() - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('limitado', TRUE);
  END IF;

  v_token := public.mm_novo_token();
  INSERT INTO public.mm_acessos (participante_id, empresa_id, token_hash, expira_em)
  VALUES (v_part.id, v_emp.id, public.mm_hash(v_token), now() + interval '30 minutes');

  SELECT to_jsonb(array_agg(DISTINCT x ORDER BY x)) INTO v_emails
  FROM unnest(ARRAY[lower(v_part.email), lower(v_emp.email)]) AS x
  WHERE x IS NOT NULL AND x <> '';

  RETURN jsonb_build_object(
    'token',        v_token,
    'razao_social', v_emp.razao_social,
    'nome',         v_part.nome,
    'emails',       v_emails
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Confirmação do link (página /maiores-e-melhores/acesso)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mm_acesso_confirmar(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acesso RECORD;
  v_sessao TEXT;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou não é válido. Peça um novo link informando o CNPJ da empresa.';
  END IF;

  UPDATE public.mm_acessos
     SET usado_em = now()
   WHERE token_hash = public.mm_hash(p_token)
     AND usado_em IS NULL
     AND expira_em > now()
  RETURNING participante_id, empresa_id INTO v_acesso;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este link venceu, já foi usado ou não é válido. Peça um novo link informando o CNPJ da empresa.';
  END IF;

  v_sessao := public.mm_novo_token();
  INSERT INTO public.mm_sessoes (participante_id, sessao_hash, expira_em, origem)
  VALUES (v_acesso.participante_id, public.mm_hash(v_sessao), now() + interval '180 days', 'link_email');

  RETURN jsonb_build_object('token', v_sessao, 'empresa_id', v_acesso.empresa_id);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Permissões
-- ───────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.mm_acesso_solicitar(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm_acesso_solicitar(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.mm_acesso_confirmar(TEXT) TO anon, authenticated;
