import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

// Usa o supabase admin para criar a função via pg_query
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const sql = `
CREATE OR REPLACE FUNCTION public.criar_administrador(
  p_email    TEXT,
  p_senha    TEXT,
  p_nome     TEXT,
  p_senha_hash TEXT
)
RETURNS UUID AS $$
DECLARE
  v_auth_user_id UUID;
  v_empresa_id   UUID;
  v_timestamp    TEXT;
BEGIN
  v_auth_user_id := gen_random_uuid();
  v_empresa_id   := gen_random_uuid();
  v_timestamp    := extract(epoch from now())::BIGINT::TEXT;

  -- 1. Insere no auth.users ja com email confirmado (sem precisar confirmar por email)
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    role, aud, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    v_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_senha, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    false, 'authenticated', 'authenticated', now(), now(),
    '', '', '', ''
  );

  -- 2. Cria o identity para o login funcionar
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_email, v_auth_user_id,
    jsonb_build_object('sub', v_auth_user_id::TEXT, 'email', p_email),
    'email', now(), now(), now()
  );

  -- 3. Insere na tabela empresas
  INSERT INTO public.empresas (
    id, email, nome_responsavel, tipo_usuario, senha_hash, senha_temporaria,
    razao_social, cnpj, telefone_principal,
    emite_nota_fiscal, tem_conta_pj, autoriza_compartilhamento,
    diversidade_global, acesso_tipo, area_empresa, area_geografica,
    sobre_empresa, formas_pagamento, formas_recebimento, e_socio, tem_negros_socios
  ) VALUES (
    v_empresa_id, p_email, p_nome, 'adm', p_senha_hash, true,
    'Administracao ' || v_timestamp,
    ('00' || v_timestamp)::TEXT,
    ('00' || v_timestamp)::TEXT,
    false, false, false, 0, 'ADMIN', 'Tecnologia', 'Nacional',
    'Administrador do sistema', '{}', '{}', false, false
  );

  -- 4. Insere o vinculo na empresa_usuarios
  INSERT INTO public.empresa_usuarios (
    auth_user_id, empresa_id, email, nome, papel, status
  ) VALUES (
    v_auth_user_id, v_empresa_id, p_email, p_nome, 'admin', 'ativo'
  );

  RETURN v_empresa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.criar_administrador(TEXT, TEXT, TEXT, TEXT) TO authenticated;
`;

async function run() {
  // Usa o endpoint /rest/v1/rpc/exec_sql se existir, senão usa pg direto
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_text: sql })
  });

  const text = await response.text();
  console.log('Status:', response.status);
  console.log('Resposta:', text.substring(0, 300));

  if (!response.ok) {
    // Tenta criar uma função temporária exec_sql para executar DDL
    console.log('\nTentando via supabase-js auth.admin...');
    
    // Usa o auth admin API para verificar se temos acesso
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (listErr) {
      console.error('Sem acesso admin:', listErr.message);
    } else {
      console.log('Acesso admin confirmado. Total users:', users.users.length);
    }
    
    console.log('\nNao foi possivel executar DDL via cliente. Por favor execute o SQL manualmente no Supabase SQL Editor.');
    console.log('\nO SQL esta salvo em: 16_criar_administrador_rpc.sql');
  }
}

run().catch(console.error);
