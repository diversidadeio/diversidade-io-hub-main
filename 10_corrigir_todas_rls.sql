-- Script Definitivo para RLS usando Security Definer (Evita Infinite Recursion)

-- 1. Função de acesso que burla o RLS interno para checagem rápida (muito mais performático)
CREATE OR REPLACE FUNCTION check_empresa_access(p_empresa_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios 
    WHERE auth_user_id = auth.uid() AND empresa_id = p_empresa_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tabela: empresas
DROP POLICY IF EXISTS "empresas_select_auth" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_auth" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_anon" ON public.empresas;
DROP POLICY IF EXISTS "Permitir select para donos da empresa" ON public.empresas;
DROP POLICY IF EXISTS "Permitir update para donos da empresa" ON public.empresas;

CREATE POLICY "empresas_select_auth" ON public.empresas FOR SELECT TO authenticated
USING (check_empresa_access(id));

CREATE POLICY "empresas_select_anon" ON public.empresas FOR SELECT TO anon
USING (true);

CREATE POLICY "empresas_update_auth" ON public.empresas FOR UPDATE TO authenticated
USING (check_empresa_access(id));

-- 3. Tabela: empresa_usuarios (Evitar recursão infinita aqui também!)
DROP POLICY IF EXISTS "ver_membros_empresa" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "atualizar_proprio_perfil" ON public.empresa_usuarios;

CREATE POLICY "ver_membros_empresa" ON public.empresa_usuarios FOR SELECT TO authenticated
USING (check_empresa_access(empresa_id));

CREATE POLICY "atualizar_proprio_perfil" ON public.empresa_usuarios FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid()); -- O usuário pode atualizar a si mesmo
