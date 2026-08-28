-- Migration 27: O prazo final encerra o link compartilhável
-- Diversidade.io — 2026
--
-- Regra: passada a data de prazo_final, a página /oportunidades/:id deixa de abrir
-- e a RPC de resposta recusa novas manifestações de interesse.
-- O dia do prazo ainda conta como aberto (encerra à meia-noite do dia seguinte).
--
-- A data é comparada no fuso de São Paulo — CURRENT_DATE no Supabase é UTC e
-- fecharia o link 3 horas antes da virada no Brasil.

-- ───────────────────────────────────────────────────────────────────────────
-- Helper: data de hoje no fuso de São Paulo
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hoje_brasil()
RETURNS DATE
LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- obter_oportunidade — passa a recusar depois do prazo
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

  -- Encerramento automático pelo prazo final
  IF v_sol.prazo_final IS NOT NULL AND v_sol.prazo_final < public.hoje_brasil() THEN
    RAISE EXCEPTION 'prazo_encerrado' USING ERRCODE = '42501';
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
-- responder_oportunidade — recusa resposta fora do prazo ou com link desativado
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
  v_sol public.solicitacoes_busca%ROWTYPE;
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

  IF v_sol.prazo_final IS NOT NULL AND v_sol.prazo_final < public.hoje_brasil() THEN
    RAISE EXCEPTION 'prazo_encerrado' USING ERRCODE = '42501';
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
-- registrar_visualizacao_oportunidade — não conta clique em link já encerrado
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
  v_sol public.solicitacoes_busca%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_busca WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF COALESCE(v_sol.compartilhavel, TRUE) = FALSE THEN RETURN; END IF;
  IF v_sol.prazo_final IS NOT NULL AND v_sol.prazo_final < public.hoje_brasil() THEN RETURN; END IF;

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
-- Permissões (as funções foram recriadas)
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.obter_oportunidade(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_visualizacao_oportunidade(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.responder_oportunidade(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hoje_brasil() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.obter_oportunidade(UUID)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_visualizacao_oportunidade(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_oportunidade(UUID, BOOLEAN, TEXT)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.hoje_brasil()                                         TO authenticated;
