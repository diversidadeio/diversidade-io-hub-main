-- Este script recria a tabela logs_acesso e a função registrar_log_acesso
-- com a tipagem correta para o seu banco de dados atual (onde empresa_id é UUID).

-- 1. Remover dependências antigas
DROP POLICY IF EXISTS "admins_podem_ver_logs" ON logs_acesso;
DROP POLICY IF EXISTS "empresas_podem_ver_seus_logs" ON logs_acesso;
DROP FUNCTION IF EXISTS registrar_log_acesso(text, text, bigint, text, text, text, text, text);
DROP FUNCTION IF EXISTS registrar_log_acesso(text, text, uuid, text, text, text, text, text);

-- 2. Recriar/Atualizar a Tabela logs_acesso
-- Como os logs estão vazios no momento, podemos dropar para garantir a estrutura 100% limpa
DROP TABLE IF EXISTS logs_acesso CASCADE;

CREATE TABLE logs_acesso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    tipo_evento TEXT NOT NULL,
    empresa_id UUID, -- Modificado para UUID, correspondendo à tabela empresas
    nome_empresa TEXT,
    executor_adm_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    detalhes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);



-- 3. Habilitar RLS
ALTER TABLE logs_acesso ENABLE ROW LEVEL SECURITY;

-- 4. Criar função de registro (RPC) com SECURITY DEFINER
-- Usa UUID para p_empresa_id!
CREATE OR REPLACE FUNCTION registrar_log_acesso(
    p_email TEXT,
    p_tipo_evento TEXT,
    p_empresa_id UUID DEFAULT NULL,
    p_nome_empresa TEXT DEFAULT NULL,
    p_executor_adm_email TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_detalhes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO logs_acesso (
        email, 
        tipo_evento, 
        empresa_id,
        nome_empresa, 
        executor_adm_email, 
        ip_address, 
        user_agent, 
        detalhes
    )
    VALUES (
        p_email, 
        p_tipo_evento, 
        p_empresa_id,
        p_nome_empresa, 
        p_executor_adm_email, 
        p_ip_address, 
        p_user_agent, 
        p_detalhes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar policies de leitura
-- Admin pode ler todos os logs (verifica na tabela empresas se tipo_usuario = 'adm')
CREATE POLICY "admins_podem_ver_logs" ON logs_acesso
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM empresas
      WHERE id = auth.uid() AND tipo_usuario = 'adm'
    )
  );

-- Empresas podem ler apenas os seus próprios logs (onde o empresa_id do log é o próprio UID do usuário)
CREATE POLICY "empresas_podem_ver_seus_logs" ON logs_acesso
  FOR SELECT
  USING (
    empresa_id = auth.uid()
  );
