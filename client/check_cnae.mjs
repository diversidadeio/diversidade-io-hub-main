import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
  const { data: cols } = await supabase.rpc('get_cnaes');
  console.log(cols);
}
run();
