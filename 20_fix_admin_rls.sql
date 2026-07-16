-- Script para permitir que administradores do sistema ignorem restrições de RLS (Row Level Security)
-- 1. Cria a função is_system_admin() para checar se o usuário atual é um "adm"
-- 2. Atualiza check_empresa_access() para retornar TRUE se for admin

CREATE OR REPLACE FUNCTION is_system_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    JOIN public.empresas e ON e.id = eu.empresa_id
    WHERE eu.auth_user_id = auth.uid() AND e.tipo_usuario = 'adm'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_empresa_access(p_empresa_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  -- Se for um administrador do sistema, tem acesso a tudo
  IF is_system_admin() THEN
    RETURN TRUE;
  END IF;

  -- Caso contrário, verifica se o usuário pertence à empresa requisitada
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios 
    WHERE auth_user_id = auth.uid() AND empresa_id = p_empresa_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
