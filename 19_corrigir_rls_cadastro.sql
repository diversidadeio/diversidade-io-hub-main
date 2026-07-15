-- Política para permitir que um usuário recém-cadastrado se vincule à empresa que acabou de criar.
-- Esta política permite o INSERT na tabela empresa_usuarios desde que:
-- 1. O usuário esteja inserindo o seu próprio ID (auth_user_id = auth.uid())
-- 2. A empresa informada ainda não possua NENHUM usuário vinculado (evita que se vinculem a empresas de outros).

CREATE POLICY "permitir_inserir_primeiro_usuario" ON public.empresa_usuarios
FOR INSERT TO authenticated
WITH CHECK (
  auth_user_id = auth.uid() AND
  NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = empresa_usuarios.empresa_id
  )
);
