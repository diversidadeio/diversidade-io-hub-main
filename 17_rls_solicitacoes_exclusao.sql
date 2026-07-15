-- 17_rls_solicitacoes_exclusao.sql
-- Este script corrige as permissões (RLS) da tabela de solicitações de exclusão.
-- Ele permite que o usuário consiga enviar o pedido e o admin consiga listar todos.

-- Habilitar RLS na tabela (se não estiver habilitado)
ALTER TABLE public.solicitacoes_exclusao ENABLE ROW LEVEL SECURITY;

-- 1. Permitir que usuários autenticados da própria empresa possam inserir solicitações
DROP POLICY IF EXISTS "solicitacoes_insert" ON public.solicitacoes_exclusao;
CREATE POLICY "solicitacoes_insert" ON public.solicitacoes_exclusao 
FOR INSERT TO authenticated
WITH CHECK (check_empresa_access(empresa_id));

-- 2. Permitir que o admin possa atualizar o status
DROP POLICY IF EXISTS "solicitacoes_update" ON public.solicitacoes_exclusao;
CREATE POLICY "solicitacoes_update" ON public.solicitacoes_exclusao 
FOR UPDATE TO authenticated
USING (true); 

-- 3. Permitir que o admin consiga listar todas as solicitações no Painel ADM
DROP POLICY IF EXISTS "solicitacoes_select_admin" ON public.solicitacoes_exclusao;
CREATE POLICY "solicitacoes_select_admin" ON public.solicitacoes_exclusao
FOR SELECT TO authenticated
USING (true);
