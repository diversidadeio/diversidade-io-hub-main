-- Criar função para verificar se o usuário atual é admin da empresa
CREATE OR REPLACE FUNCTION check_is_admin(p_empresa_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios 
    WHERE auth_user_id = auth.uid() AND empresa_id = p_empresa_id AND papel = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar política de INSERT para administradores
DROP POLICY IF EXISTS "admin_insert_usuarios" ON public.empresa_usuarios;
CREATE POLICY "admin_insert_usuarios" ON public.empresa_usuarios FOR INSERT TO authenticated
WITH CHECK (check_is_admin(empresa_id));

-- Adicionar política de DELETE para administradores
DROP POLICY IF EXISTS "admin_delete_usuarios" ON public.empresa_usuarios;
CREATE POLICY "admin_delete_usuarios" ON public.empresa_usuarios FOR DELETE TO authenticated
USING (check_is_admin(empresa_id));
