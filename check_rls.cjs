const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ezvpveejlofauixfpizs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc1OTc0NjksImV4cCI6MjAzMzE3MzQ2OX0.n7OTCDXlmLzdwIAaUwjxV3lp0qHzD33m608PKmuz7sc';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: emp } = await anonClient.from('empresas').select('id').eq('cnpj', '10.866.066/0001-12').single();
  if (!emp) {
    console.log('Empresa not found');
    return;
  }
  
  const { data: sociosAnon, error: err1 } = await anonClient.from('socios').select('*').eq('empresa_id', emp.id);
  const { data: sociosService, error: err2 } = await serviceClient.from('socios').select('*').eq('empresa_id', emp.id);
  
  console.log('Anon socios length:', sociosAnon?.length);
  console.log('Service socios length:', sociosService?.length);

  // If RLS is blocking, let's look at the policies
  if (sociosAnon?.length !== sociosService?.length) {
     const { data: policies } = await serviceClient.from('pg_policies').select('*').eq('tablename', 'socios');
     console.log('Policies for socios table:');
     console.log(policies);
  }
}

check();
