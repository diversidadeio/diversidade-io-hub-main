import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// Usuário de teste
const authUserId = '743e8a47-18ce-4d1c-9ea5-2fb076a0b951';
const empresaId  = '4f799ca4-cc6a-4e6c-98fe-3b3613ddd7ed';

// Gera nova senha de teste
const senhaPlana = 'Teste@2026x';

async function resetar() {
  console.log('Senha de teste:', senhaPlana);

  // 1. Atualiza auth.users via admin API
  const { error: authErr } = await supabase.auth.admin.updateUserById(authUserId, {
    password: senhaPlana
  });

  if (authErr) {
    console.error('❌ Erro ao atualizar auth.users:', authErr.message);
    return;
  }
  console.log('✅ auth.users atualizado');

  // 2. Atualiza empresas.senha_hash com o mesmo hash usado pelo front-end
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(senhaPlana));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { error: empErr } = await supabase
    .from('empresas')
    .update({ senha_hash: hashHex, senha_temporaria: true })
    .eq('id', empresaId);

  if (empErr) {
    console.error('❌ Erro ao atualizar empresas:', empErr.message);
    return;
  }
  console.log('✅ empresas.senha_hash atualizado');

  console.log('\n🔑 Agora tente logar com:');
  console.log('   E-mail: tecnologia+teste@diversidade.io');
  console.log('   Senha: ', senhaPlana);
}

resetar().catch(console.error);
