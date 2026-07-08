-- Correção definitiva das políticas RLS para a tabela empresas e tabelas filhas
-- Agora que os usuários logarão via Supabase Auth, precisamos garantir que o role 'authenticated'
-- tenha permissão de SELECT, UPDATE nas tabelas da sua empresa.

-- 1. Tabela empresas
DROP POLICY IF EXISTS "Permitir select para donos da empresa" ON public.empresas;
DROP POLICY IF EXISTS "Permitir update para donos da empresa" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update" ON public.empresas;

-- Política para Leitura: usuário logado pode ler a empresa se estiver vinculado a ela
CREATE POLICY "empresas_select_auth"
ON public.empresas FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT empresa_id FROM public.empresa_usuarios WHERE auth_user_id = auth.uid()
  )
);

-- Para permitir que novos cadastros (não logados) leiam o CNPJ para validar duplicidade
CREATE POLICY "empresas_select_anon"
ON public.empresas FOR SELECT
TO anon
USING (true);

-- Política para Atualização: usuário logado pode atualizar a empresa se for admin
CREATE POLICY "empresas_update_auth"
ON public.empresas FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT empresa_id FROM public.empresa_usuarios WHERE auth_user_id = auth.uid() AND papel = 'admin'
  )
);

-- 2. Aplicar a mesma lógica para tabelas relacionadas que são carregadas no MeuCadastro
-- (Ceps, Sócios, Gestores, etc) - garantindo que pelo menos o SELECT funcione.

CREATE OR REPLACE FUNCTION check_empresa_access(p_empresa_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuarios 
    WHERE auth_user_id = auth.uid() AND empresa_id = p_empresa_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo: ceps_impactados
DROP POLICY IF EXISTS "ceps_select" ON public.ceps_impactados;
CREATE POLICY "ceps_select" ON public.ceps_impactados FOR SELECT TO authenticated
USING (check_empresa_access(empresa_id));

-- Exemplo: socios
DROP POLICY IF EXISTS "socios_select" ON public.socios;
CREATE POLICY "socios_select" ON public.socios FOR SELECT TO authenticated
USING (check_empresa_access(empresa_id));

-- Exemplo: solicitacoes_exclusao
DROP POLICY IF EXISTS "solicitacoes_select" ON public.solicitacoes_exclusao;
CREATE POLICY "solicitacoes_select" ON public.solicitacoes_exclusao FOR SELECT TO authenticated
USING (check_empresa_access(empresa_id));
