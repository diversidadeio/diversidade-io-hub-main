const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ezvpveejlofauixfpizs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc');

async function run() {
  const { data, error } = await supabase.from('empresas').select('status_aprovacao').limit(1);
  console.log(data, error);
}
run();
