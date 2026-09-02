import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const email = 'anj.eduardo.uac@sebrae.com.br';
  console.log(`Buscando usuario com email: ${email}`);
  
  // Update Auth password
  const tempPassword = 'SenhaTemp' + Math.floor(10000 + Math.random() * 90000) + '!';
  
  // List auth users
  let allUsers = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length === 0) hasMore = false;
    else page++;
  }
  
  const user = allUsers.find(u => u.email === email);
  if (user) {
    await supabase.auth.admin.updateUserById(user.id, { password: tempPassword });
    console.log(`Senha atualizada no Auth para: ${tempPassword}`);
  } else {
    console.log('Usuario nao encontrado no Auth, mas vamos tentar atualizar nas tabelas.');
  }

  // Update senha_temporaria in all possible tables
  const tables = ['empresas', 'administradores', 'empresa_usuarios'];
  let foundInTable = false;
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').eq('email', email);
    if (data && data.length > 0) {
      console.log(`Encontrado na tabela: ${table}`);
      foundInTable = true;
      const { error: updateError } = await supabase.from(table).update({ senha_temporaria: true }).eq('email', email);
      if (updateError) {
         console.error(`Erro ao atualizar ${table}:`, updateError);
      } else {
         console.log(`senha_temporaria definida como TRUE em ${table}`);
      }
    }
  }
  
  if (!foundInTable) {
    console.log('Usuario nao encontrado em nenhuma das tabelas (empresas, administradores, empresa_usuarios).');
  }
}

main();
