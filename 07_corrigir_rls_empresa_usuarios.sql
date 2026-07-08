-- Correção das políticas RLS da tabela empresa_usuarios
-- para usar auth_user_id (auth.uid()) ao invés de e-mail

-- Remover policies antigas
DROP POLICY IF EXISTS "Usuários podem ver membros da sua empresa" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Administradores podem inserir usuários" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Administradores podem deletar usuários" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Usuários e admins podem atualizar dados" ON public.empresa_usuarios;

-- 1. Usuário logado pode ler todos da sua empresa
CREATE POLICY "ver_membros_empresa"
ON public.empresa_usuarios FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.empresa_usuarios WHERE auth_user_id = auth.uid()
  )
);

-- 2. O próprio usuário (pelo auth_user_id) pode atualizar seus dados pessoais
CREATE POLICY "atualizar_proprio_perfil"
ON public.empresa_usuarios FOR UPDATE
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.auth_user_id = auth.uid()
      AND eu.papel = 'admin'
      AND eu.empresa_id = empresa_usuarios.empresa_id
  )
);

-- 3. Inserção: permitir qualquer usuário autenticado inserir (para o trigger funcionar via service_role)
-- O controle de empresa é feito na lógica do trigger e da aplicação
CREATE POLICY "inserir_usuario"
ON public.empresa_usuarios FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Admin pode deletar usuários da empresa
CREATE POLICY "deletar_usuario"
ON public.empresa_usuarios FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.auth_user_id = auth.uid()
      AND eu.papel = 'admin'
      AND eu.empresa_id = empresa_usuarios.empresa_id
  )
);

-- Garantir que a RPC obter_sessao_usuario tenha permissão
GRANT EXECUTE ON FUNCTION obter_sessao_usuario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;

-- Criar registros faltantes: usuários que existem no auth.users mas ainda não têm empresa_usuarios
-- (para os que foram migrados pelo script Node.js ANTES do trigger existir)
INSERT INTO public.empresa_usuarios (auth_user_id, empresa_id, email, nome, papel, status)
SELECT 
  au.id AS auth_user_id,
  e.id AS empresa_id,
  e.email,
  e.nome_responsavel AS nome,
  'admin' AS papel,
  'ativo' AS status
FROM auth.users au
JOIN public.empresas e ON e.email = au.email
WHERE NOT EXISTS (
  SELECT 1 FROM public.empresa_usuarios eu WHERE eu.auth_user_id = au.id
)
ON CONFLICT DO NOTHING;
