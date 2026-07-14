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

const supabase = createClient(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false }
});

const emailParaVerificar = 'tecnologia+teste@diversidade.io';

async function diagnosticar() {
  console.log(`\n=== Diagnóstico: ${emailParaVerificar} ===\n`);

  // 1. Verifica na tabela empresas
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, email, nome_responsavel, tipo_usuario, senha_temporaria')
    .eq('email', emailParaVerificar)
    .maybeSingle();

  if (empresa) {
    console.log('✅ Encontrado em EMPRESAS:');
    console.log('   ID:', empresa.id);
    console.log('   Tipo:', empresa.tipo_usuario);
    console.log('   Senha temporária:', empresa.senha_temporaria);
  } else {
    console.log('❌ NÃO encontrado em EMPRESAS');
  }

  // 2. Verifica em empresa_usuarios
  const { data: vinculo } = await supabase
    .from('empresa_usuarios')
    .select('auth_user_id, empresa_id, papel, status')
    .eq('email', emailParaVerificar)
    .maybeSingle();

  if (vinculo) {
    console.log('\n✅ Encontrado em EMPRESA_USUARIOS:');
    console.log('   auth_user_id:', vinculo.auth_user_id);
    console.log('   empresa_id:', vinculo.empresa_id);
    console.log('   papel:', vinculo.papel);
  } else {
    console.log('\n❌ NÃO encontrado em EMPRESA_USUARIOS');
    console.log('   → PROBLEMA: sem vínculo com o sistema de login');
  }

  // 3. Verifica em auth.users
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const authUser = users.find(u => u.email === emailParaVerificar);

  if (authUser) {
    console.log('\n✅ Encontrado em AUTH.USERS:');
    console.log('   ID:', authUser.id);
    console.log('   Confirmado em:', authUser.email_confirmed_at || 'NÃO CONFIRMADO');
    console.log('   Criado em:', authUser.created_at);
  } else {
    console.log('\n❌ NÃO encontrado em AUTH.USERS');
    console.log('   → PROBLEMA: usuário não tem credencial de login');
  }

  // Resumo
  console.log('\n=== CONCLUSÃO ===');
  if (!authUser) {
    console.log('🔴 O usuário foi cadastrado ANTES da migração para Supabase Auth.');
    console.log('   Ele existe só na tabela "empresas" (senha antiga), mas não tem conta de login.');
    console.log('   A senha temporária gerada não funciona porque não há conta para logar.');
  } else if (!vinculo) {
    console.log('🟡 O usuário tem conta de login mas sem vínculo (empresa_usuarios).');
    console.log('   O login autentica mas não encontra os dados de sessão.');
  } else {
    console.log('🟢 Usuário completo. O problema pode ser a senha desatualizada.');
  }
}

diagnosticar().catch(console.error);
