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
  
  // Listar todos os usuarios
  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000
    });
    
    if (error) {
      console.error('Erro ao listar usuarios:', error);
      return;
    }
    
    allUsers = allUsers.concat(data.users);
    
    if (data.users.length === 0) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  const user = allUsers.find(u => u.email === email);
  if (!user) {
    console.log('Usuario nao encontrado.');
    return;
  }
  
  console.log(`Usuario encontrado: ${user.id}`);
  
  const tempPassword = 'SenhaTemp' + Math.floor(10000 + Math.random() * 90000) + '!';
  
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: tempPassword }
  );
  
  if (updateError) {
    console.error('Erro ao atualizar senha:', updateError);
    return;
  }
  
  console.log(`Senha temporaria gerada com sucesso: ${tempPassword}`);
}

main();
