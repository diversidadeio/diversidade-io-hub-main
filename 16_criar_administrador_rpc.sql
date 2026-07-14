-- =============================================================
-- FUNÇÃO: criar_administrador
-- Cria um usuário ADM já com e-mail confirmado (sem confirmação por e-mail)
-- Executa com SECURITY DEFINER para ter acesso ao schema auth.*
-- =============================================================

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
  -- Gera IDs únicos
  v_auth_user_id := gen_random_uuid();
  v_empresa_id   := gen_random_uuid();
  v_timestamp    := extract(epoch from now())::BIGINT::TEXT;

  -- 1. Insere diretamente no auth.users já com e-mail confirmado
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_senha, gen_salt('bf')),
    now(),                          -- já confirmado!
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome),
    false,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 2. Cria também o identity para login funcionar
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_email,
    v_auth_user_id,
    jsonb_build_object('sub', v_auth_user_id::TEXT, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );

  -- 3. Insere na tabela empresas
  INSERT INTO public.empresas (
    id,
    email,
    nome_responsavel,
    tipo_usuario,
    senha_hash,
    senha_temporaria,
    razao_social,
    cnpj,
    telefone_principal,
    emite_nota_fiscal,
    tem_conta_pj,
    autoriza_compartilhamento,
    diversidade_global,
    acesso_tipo,
    area_empresa,
    area_geografica,
    sobre_empresa,
    formas_pagamento,
    formas_recebimento,
    e_socio,
    tem_negros_socios
  ) VALUES (
    v_empresa_id,
    p_email,
    p_nome,
    'adm',
    p_senha_hash,
    true,
    'Administração ' || v_timestamp,
    ('00' || v_timestamp)::TEXT,
    ('00' || v_timestamp)::TEXT,
    false,
    false,
    false,
    0,
    'ADMIN',
    'Tecnologia',
    'Nacional',
    'Administrador do sistema',
    '{}',
    '{}',
    false,
    false
  );

  -- 4. Insere o vínculo na empresa_usuarios
  INSERT INTO public.empresa_usuarios (
    auth_user_id,
    empresa_id,
    email,
    nome,
    papel,
    status
  ) VALUES (
    v_auth_user_id,
    v_empresa_id,
    p_email,
    p_nome,
    'admin',
    'ativo'
  );

  RETURN v_empresa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Libera a execução para usuários autenticados (ADMs do painel)
GRANT EXECUTE ON FUNCTION public.criar_administrador(TEXT, TEXT, TEXT, TEXT) TO authenticated;
