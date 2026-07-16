-- Script Consolidado para Corrigir RLS (Row Level Security)
-- Resolve:
-- 1. O Administrador não conseguia ver os dados de Sócios e CEPs (pois não pertencia à empresa)
-- 2. O Administrador não conseguia aprovar o cadastro (UPDATE era bloqueado silenciosamente)
-- 3. A duplicação de Sócios e CEPs ao salvar no "Meu Cadastro" (O comando DELETE era bloqueado silenciosamente)

-- Parte 1: Criação da função de verificação de Administrador
CREATE OR REPLACE FUNCTION is_system_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    JOIN public.empresas e ON e.id = eu.empresa_id
    WHERE eu.auth_user_id = auth.uid() AND e.tipo_usuario = 'adm'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Parte 2: Atualização da função base de acesso às empresas
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

-- Parte 3: Adicionar políticas que faltavam para Evitar Duplicações e permitir Edições
-- Tabela socios
DROP POLICY IF EXISTS "socios_insert" ON public.socios;
DROP POLICY IF EXISTS "socios_update" ON public.socios;
DROP POLICY IF EXISTS "socios_delete" ON public.socios;

CREATE POLICY "socios_insert" ON public.socios FOR INSERT TO authenticated
WITH CHECK (check_empresa_access(empresa_id));

CREATE POLICY "socios_update" ON public.socios FOR UPDATE TO authenticated
USING (check_empresa_access(empresa_id));

CREATE POLICY "socios_delete" ON public.socios FOR DELETE TO authenticated
USING (check_empresa_access(empresa_id));

-- Tabela ceps_impactados
DROP POLICY IF EXISTS "ceps_insert" ON public.ceps_impactados;
DROP POLICY IF EXISTS "ceps_update" ON public.ceps_impactados;
DROP POLICY IF EXISTS "ceps_delete" ON public.ceps_impactados;

CREATE POLICY "ceps_insert" ON public.ceps_impactados FOR INSERT TO authenticated
WITH CHECK (check_empresa_access(empresa_id));

CREATE POLICY "ceps_update" ON public.ceps_impactados FOR UPDATE TO authenticated
USING (check_empresa_access(empresa_id));

CREATE POLICY "ceps_delete" ON public.ceps_impactados FOR DELETE TO authenticated
USING (check_empresa_access(empresa_id));
