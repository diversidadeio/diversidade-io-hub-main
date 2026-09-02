import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Por favor, informe o email. Ex: node final_reset.mjs email@exemplo.com');
    process.exit(1);
  }
  
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
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password: tempPassword });
    if (updateError) {
      console.error('Erro ao atualizar senha no Auth:', updateError);
    } else {
      console.log(`NOVA_SENHA=${tempPassword}`);
    }
  } else {
    console.log('Usuario nao encontrado no Supabase Auth.');
  }
  
  // Set status pendente and senha_temporaria to force reset
  const tables = ['empresas', 'administradores', 'empresa_usuarios'];
  let foundInTable = false;
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').eq('email', email);
    if (data && data.length > 0) {
      console.log(`Usuario encontrado na tabela: ${table}`);
      foundInTable = true;
      
      let updateData = {};
      if (table === 'empresa_usuarios') {
        updateData.status = 'pendente';
      } else {
        updateData.senha_temporaria = true;
      }
      
      const { error: updateError } = await supabase.from(table).update(updateData).eq('email', email);
      if (updateError) {
         console.error(`Erro ao atualizar ${table}:`, updateError);
      } else {
         console.log(`Status de troca de senha atualizado em ${table}`);
      }
    }
  }
  
  if (!foundInTable) {
    console.log('Aviso: O usuario nao foi encontrado em nenhuma tabela relacional do sistema.');
  }
}

main();
