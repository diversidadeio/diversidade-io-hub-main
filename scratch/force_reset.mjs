import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const email = 'anj.eduardo.uac@sebrae.com.br';
  const { error } = await supabase.from('empresa_usuarios').update({ status: 'pendente' }).eq('email', email);
  if (error) console.error('Erro ao atualizar status:', error);
  else console.log('Status definido como pendente.');
}
main();
