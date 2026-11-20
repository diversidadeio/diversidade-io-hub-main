-- Migration 37: Maiores & Melhores — o participante volta a ver as fotos dos próprios sócios
-- Diversidade.io — 2026
--
-- As fotos ficam num bucket privado, que só a administração lê. Para a tela "Minha inscrição"
-- mostrar a foto de cada sócio ao participante, o servidor (service_role) pergunta ao banco qual é
-- o arquivo e gera um link temporário. Esta função:
--   - confere o token do participante (sessão inválida → ERRCODE 28000);
--   - só devolve o caminho de fotos de empresas DELE;
--   - não pode ser chamada pelo navegador (anon/authenticated): o caminho nunca sai do servidor.
--
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.mm_foto_do_participante(p_token TEXT, p_empresa_id UUID, p_indice INT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part UUID := public.mm_participante_id(p_token);
BEGIN
  IF p_indice IS NULL OR p_indice < 0 THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT e.socios -> p_indice ->> 'foto_path'
    FROM public.mm_empresas e
    WHERE e.id = p_empresa_id AND e.participante_id = v_part
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mm_foto_do_participante(TEXT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm_foto_do_participante(TEXT, UUID, INT) TO service_role;
