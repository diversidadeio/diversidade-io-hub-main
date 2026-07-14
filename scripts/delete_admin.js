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

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Emails com contas incompletas para limpar
const emailsParaLimpar = [
  'suporte@diversidade.io',
  'vanessa@diversidade.io', // Adiciona outros se houver
];

async function limparContaIncompleta(email) {
  console.log(`\n--- Limpando: ${email} ---`);

  // 1. Busca na tabela empresas
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (empresa) {
    console.log(`  ✓ Removendo de empresas: ${empresa.id}`);
    await supabase.from('empresas').delete().eq('id', empresa.id);
  } else {
    console.log(`  - Não encontrado em empresas`);
  }

  // 2. Busca em empresa_usuarios
  const { data: usuario } = await supabase
    .from('empresa_usuarios')
    .select('auth_user_id')
    .eq('email', email)
    .maybeSingle();

  if (usuario) {
    console.log(`  ✓ Removendo de empresa_usuarios: ${usuario.auth_user_id}`);
    await supabase.from('empresa_usuarios').delete().eq('email', email);
  } else {
    console.log(`  - Não encontrado em empresa_usuarios`);
  }

  // 3. Busca em auth.users
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const authUser = users.find(u => u.email === email);

  if (authUser) {
    console.log(`  ✓ Removendo de auth.users: ${authUser.id}`);
    await supabase.auth.admin.deleteUser(authUser.id);
  } else {
    console.log(`  - Não encontrado em auth.users`);
  }
}

async function run() {
  for (const email of emailsParaLimpar) {
    await limparContaIncompleta(email);
  }
  console.log('\n✅ Limpeza concluída! Agora pode criar os administradores pelo painel.');
}

run().catch(console.error);
