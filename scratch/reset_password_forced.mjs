import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'anj.eduardo.uac@sebrae.com.br';
  console.log(`Buscando usuario com email: ${email}`);
  
  let page = 1;
  let allUsers = [];
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error('Erro ao listar usuarios:', error); return; }
    allUsers = allUsers.concat(data.users);
    if (data.users.length === 0) hasMore = false;
    else page++;
  }
  
  const user = allUsers.find(u => u.email === email);
  if (!user) { console.log('Usuario nao encontrado no Auth.'); return; }
  
  const tempPassword = 'SenhaTemp' + Math.floor(10000 + Math.random() * 90000) + '!';
  
  // 1. Atualizar Auth Password
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password: tempPassword });
  if (updateError) { console.error('Erro ao atualizar senha no Auth:', updateError); return; }
  
  // 2. Tentar atualizar tabela empresas
  const { data: empresaUpdate, error: empresaError } = await supabase
    .from('empresas')
    .update({ senha_temporaria: true })
    .eq('email', email)
    .select();
    
  if (empresaError) {
     console.error('Erro ao atualizar senha_temporaria em empresas:', empresaError);
  } else {
     console.log(`Atualizou ${empresaUpdate.length} registro(s) em empresas.`);
  }

  // 3. Tentar atualizar administradores, se houver tabela
  const { data: admUpdate, error: admError } = await supabase
    .from('administradores')
    .update({ senha_temporaria: true })
    .eq('email', email)
    .select();
    
  if (!admError && admUpdate && admUpdate.length > 0) {
     console.log(`Atualizou ${admUpdate.length} registro(s) em administradores.`);
  }
  
  // 4. Tentar atualizar empresa_usuarios (tabela de filiais/usuarios secundários)
  const { data: userUpdate, error: userError } = await supabase
    .from('empresa_usuarios')
    .update({ senha_temporaria: true })
    .eq('email', email)
    .select();
    
  if (!userError && userUpdate && userUpdate.length > 0) {
     console.log(`Atualizou ${userUpdate.length} registro(s) em empresa_usuarios.`);
  }
  
  console.log(`Senha temporaria gerada com sucesso: ${tempPassword}`);
}

main();
