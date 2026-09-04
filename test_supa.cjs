const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ezvpveejlofauixfpizs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc');

async function run() {
  const { data, error } = await supabase.from('empresas').select('*').limit(1);
  console.log(Object.keys(data[0] || {}));
}
run();
