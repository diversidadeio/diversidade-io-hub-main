const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('empresas')
    .update({ status_aprovacao: 'pendente' })
    .eq('id', '2f37a7df-fa9f-4789-a2f9-c225bdfa8e1d');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success: Company status reset to pendente.');
  }
}

run();
