-- Migration 41: Maiores & Melhores — link de confirmação enviado só pela plataforma
-- Diversidade.io — 2026
--
-- Antes: o navegador do participante chamava mm_registrar_negocio e mm_renovar_link direto e
-- recebia o token do link de confirmação do comprador. Com o link em mãos, o próprio participante
-- poderia abrir a página e confirmar a nota no lugar do comprador.
--
-- Agora: só o servidor (service_role) chama essas funções. Ele registra a nota e envia o e-mail com
-- o link direto ao comprador; o token nunca volta ao navegador (api/_maioresMelhoresNegocio.ts).
--
-- ORDEM: aplique DEPOIS de publicar a versão do site que registra negócios pelo servidor
-- (/api/maiores-melhores-negocio). Se aplicar antes, o site antigo deixa de registrar negócios.
-- Execute no SQL Editor do Supabase, depois da migration 40.

REVOKE EXECUTE ON FUNCTION public.mm_registrar_negocio(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_renovar_link(TEXT, UUID)       FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mm_registrar_negocio(TEXT, JSONB) TO service_role;
GRANT  EXECUTE ON FUNCTION public.mm_renovar_link(TEXT, UUID)       TO service_role;
