-- 18_deletar_empresa_completo.sql
-- Função RPC segura para deletar TODOS os dados de uma empresa.
-- Usa SECURITY DEFINER para ter permissão de apagar do auth.users.
-- ATENÇÃO: Esta operação é IRREVERSÍVEL.

CREATE OR REPLACE FUNCTION public.deletar_empresa_completo(p_empresa_id UUID)
RETURNS VOID AS $$
DECLARE
  v_auth_user_ids UUID[];
BEGIN
  -- 1. Coleta os auth_user_ids vinculados à empresa (para excluir do auth.users depois)
  SELECT ARRAY_AGG(auth_user_id)
  INTO v_auth_user_ids
  FROM public.empresa_usuarios
  WHERE empresa_id = p_empresa_id
    AND auth_user_id IS NOT NULL;

  -- 2. Deleta sócios vinculados à empresa
  DELETE FROM public.socios WHERE empresa_id = p_empresa_id;

  -- 3. Deleta CEPs impactados vinculados à empresa
  DELETE FROM public.ceps_impactados WHERE empresa_id = p_empresa_id;

  -- 4. Deleta vínculos de usuários da empresa
  DELETE FROM public.empresa_usuarios WHERE empresa_id = p_empresa_id;

  -- 5. Deleta a solicitação de exclusão
  DELETE FROM public.solicitacoes_exclusao WHERE empresa_id = p_empresa_id;

  -- 6. Deleta a empresa
  DELETE FROM public.empresas WHERE id = p_empresa_id;

  -- 7. Por último, deleta os usuários do auth.users (requer SECURITY DEFINER)
  IF v_auth_user_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_auth_user_ids);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permite que usuários autenticados (administradores do painel) chamem esta função
GRANT EXECUTE ON FUNCTION public.deletar_empresa_completo(UUID) TO authenticated;
