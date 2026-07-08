-- Script para liberar leitura (SELECT) na tabela empresas para qualquer usuário autenticado
-- Isso permite que a página de Pesquisa liste todas as empresas parceiras corretamente.
-- O UPDATE continua restrito apenas aos membros da própria empresa.

DROP POLICY IF EXISTS "empresas_select_auth" ON public.empresas;

CREATE POLICY "empresas_select_auth" ON public.empresas FOR SELECT TO authenticated
USING (true);
