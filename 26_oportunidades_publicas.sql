-- Migration 26: Página pública de oportunidade (solicitação de busca compartilhável)
-- Diversidade.io — 2026
--
-- O que este script faz:
--  1. Adiciona título, prazo final e flag de compartilhamento nas solicitações de busca
--  2. Cria a tabela de visualizações (quem clicou no link compartilhado)
--  3. Cria a tabela de participações (quem pediu para participar)
--  4. Cria RPCs SECURITY DEFINER usadas pela página /oportunidades/:id
--
-- Execute no SQL Editor do Supabase.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Novos campos na solicitação
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.solicitacoes_busca
  ADD COLUMN IF NOT EXISTS titulo         TEXT,
  ADD COLUMN IF NOT EXISTS prazo_final    DATE,
  ADD COLUMN IF NOT EXISTS compartilhavel BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.solicitacoes_busca.titulo IS 'Título curto exibido na página compartilhável';
COMMENT ON COLUMN public.solicitacoes_busca.prazo_final IS 'Data limite para manifestação de interesse';
COMMENT ON COLUMN public.solicitacoes_busca.compartilhavel IS 'Quando FALSE, o link público deixa de abrir';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Visualizações do link compartilhado
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitacao_visualizacoes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID        NOT NULL REFERENCES public.solicitacoes_busca(id) ON DELETE CASCADE,
  auth_user_id   UUID,
  empresa_id     UUID        REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome           TEXT,
  email          TEXT,
  user_agent     TEXT,
  origem         TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sol_visu_solicitacao ON public.solicitacao_visualizacoes (solicitacao_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_sol_visu_usuario     ON public.solicitacao_visualizacoes (solicitacao_id, auth_user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Manifestações de interesse
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitacao_participacoes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  UUID        NOT NULL REFERENCES public.solicitacoes_busca(id) ON DELETE CASCADE,
  auth_user_id    UUID        NOT NULL,
  empresa_id      UUID        REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome            TEXT,
  email           TEXT,
  telefone        TEXT,
  quer_participar BOOLEAN     NOT NULL DEFAULT TRUE,
  mensagem        TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (solicitacao_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_sol_part_solicitacao ON public.solicitacao_participacoes (solicitacao_id, criado_em DESC);

DROP TRIGGER IF EXISTS trigger_sol_participacoes_atualizado_em ON public.solicitacao_participacoes;
CREATE TRIGGER trigger_sol_participacoes_atualizado_em
  BEFORE UPDATE ON public.solicitacao_participacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atualizado_em();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RLS — leitura para o admin e para a empresa dona da solicitação.
--    A escrita acontece exclusivamente pelas RPCs SECURITY DEFINER abaixo.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.solicitacao_visualizacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_participacoes  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver_visualizacoes_solicitacao" ON public.solicitacao_visualizacoes;
CREATE POLICY "ver_visualizacoes_solicitacao" ON public.solicitacao_visualizacoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solicitacoes_busca s
      WHERE s.id = solicitacao_id AND public.check_empresa_access(s.empresa_id)
    )
  );

DROP POLICY IF EXISTS "ver_participacoes_solicitacao" ON public.solicitacao_participacoes;
CREATE POLICY "ver_participacoes_solicitacao" ON public.solicitacao_participacoes
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_busca s
      WHERE s.id = solicitacao_id AND public.check_empresa_access(s.empresa_id)
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Helper: dados do usuário autenticado
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dados_usuario_autenticado()
RETURNS TABLE (auth_user_id UUID, empresa_id UUID, nome TEXT, email TEXT, telefone TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT v_uid,
         eu.empresa_id,
         COALESCE(eu.nome, e.nome_responsavel, e.razao_social),
         COALESCE(eu.email, e.email),
         COALESCE(eu.telefone, e.telefone_principal)
  FROM public.empresa_usuarios eu
  LEFT JOIN public.empresas e ON e.id = eu.empresa_id
  WHERE eu.auth_user_id = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT v_uid, NULL::UUID, NULL::TEXT, (auth.jwt() ->> 'email')::TEXT, NULL::TEXT;
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. RPC: carrega a oportunidade para a página compartilhada
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.obter_oportunidade(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_sol   public.solicitacoes_busca%ROWTYPE;
  v_emp   RECORD;
  v_part  RECORD;
  v_views INT;
  v_inter INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_busca WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nao_encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_sol.compartilhavel, TRUE) = FALSE THEN
    RAISE EXCEPTION 'link_desativado' USING ERRCODE = '42501';
  END IF;

  SELECT razao_social, nome_fantasia, logo_empresa_url, area_empresa, sobre_empresa
    INTO v_emp
  FROM public.empresas WHERE id = v_sol.empresa_id;

  SELECT * INTO v_part
  FROM public.solicitacao_participacoes
  WHERE solicitacao_id = p_id AND auth_user_id = v_uid;

  SELECT count(*) INTO v_views FROM public.solicitacao_visualizacoes WHERE solicitacao_id = p_id;
  SELECT count(*) INTO v_inter FROM public.solicitacao_participacoes
   WHERE solicitacao_id = p_id AND quer_participar;

  RETURN jsonb_build_object(
    'id',             v_sol.id,
    'titulo',         v_sol.titulo,
    'cnaes',          to_jsonb(v_sol.cnaes),
    'cidade',         v_sol.cidade,
    'modalidade',     v_sol.modalidade,
    'descricao',      v_sol.descricao,
    'documento_url',  v_sol.documento_url,
    'status',         v_sol.status,
    'prazo_final',    v_sol.prazo_final,
    'criado_em',      v_sol.criado_em,
    'empresa', jsonb_build_object(
      'razao_social',     v_emp.razao_social,
      'nome_fantasia',    v_emp.nome_fantasia,
      'logo_empresa_url', v_emp.logo_empresa_url,
      'area_empresa',     v_emp.area_empresa,
      'sobre_empresa',    v_emp.sobre_empresa
    ),
    'minha_participacao', CASE WHEN v_part.id IS NULL THEN NULL ELSE jsonb_build_object(
      'quer_participar', v_part.quer_participar,
      'mensagem',        v_part.mensagem,
      'criado_em',       v_part.criado_em
    ) END,
    'total_visualizacoes', v_views,
    'total_interessados',  v_inter
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. RPC: registra o clique/visualização no link compartilhado
--    Deduplica o mesmo usuário dentro de uma janela de 30 minutos.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_visualizacao_oportunidade(
  p_id         UUID,
  p_user_agent TEXT DEFAULT NULL,
  p_origem     TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_u   RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.solicitacoes_busca WHERE id = p_id) THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.solicitacao_visualizacoes
    WHERE solicitacao_id = p_id
      AND auth_user_id = v_uid
      AND criado_em > now() - INTERVAL '30 minutes'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_u FROM public.dados_usuario_autenticado();

  INSERT INTO public.solicitacao_visualizacoes
    (solicitacao_id, auth_user_id, empresa_id, nome, email, user_agent, origem)
  VALUES
    (p_id, v_uid, v_u.empresa_id, v_u.nome, v_u.email, p_user_agent, p_origem);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. RPC: manifesta (ou retira) interesse em participar
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.responder_oportunidade(
  p_id         UUID,
  p_participar BOOLEAN,
  p_mensagem   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_u   RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.solicitacoes_busca WHERE id = p_id) THEN
    RAISE EXCEPTION 'nao_encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_u FROM public.dados_usuario_autenticado();

  INSERT INTO public.solicitacao_participacoes
    (solicitacao_id, auth_user_id, empresa_id, nome, email, telefone, quer_participar, mensagem)
  VALUES
    (p_id, v_uid, v_u.empresa_id, v_u.nome, v_u.email, v_u.telefone, p_participar, NULLIF(btrim(COALESCE(p_mensagem, '')), ''))
  ON CONFLICT (solicitacao_id, auth_user_id) DO UPDATE
    SET quer_participar = EXCLUDED.quer_participar,
        mensagem        = COALESCE(EXCLUDED.mensagem, public.solicitacao_participacoes.mensagem),
        nome            = COALESCE(EXCLUDED.nome, public.solicitacao_participacoes.nome),
        email           = COALESCE(EXCLUDED.email, public.solicitacao_participacoes.email),
        telefone        = COALESCE(EXCLUDED.telefone, public.solicitacao_participacoes.telefone),
        empresa_id      = COALESCE(EXCLUDED.empresa_id, public.solicitacao_participacoes.empresa_id);

  RETURN jsonb_build_object('sucesso', TRUE, 'quer_participar', p_participar);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. Permissões
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.obter_oportunidade(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_visualizacao_oportunidade(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.responder_oportunidade(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dados_usuario_autenticado() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.obter_oportunidade(UUID)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_visualizacao_oportunidade(UUID, TEXT, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_oportunidade(UUID, BOOLEAN, TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.dados_usuario_autenticado()                            TO authenticated;
