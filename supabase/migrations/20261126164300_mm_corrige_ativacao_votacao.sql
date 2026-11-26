CREATE OR REPLACE FUNCTION public.check_empresa_access(p_empresa_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Se for um administrador do sistema, tem acesso a tudo
  IF public.is_system_admin() THEN
    RETURN TRUE;
  END IF;
  -- Caso contrário, verifica se o usuário pertence à empresa requisitada
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios
    WHERE auth_user_id = auth.uid() AND empresa_id = p_empresa_id
  );
END;
$function$;
