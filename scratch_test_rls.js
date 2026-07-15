import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
  const match = envFile.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log("Testando signUp...");
  
  const email = `test_${Date.now()}@test.com`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!'
  });
  
  if (error) {
    console.log("SignUp error:", error.message);
  } else {
    console.log("SignUp success!");
    console.log("Tem session?", !!data.session);
    console.log("User ID:", data.user?.id);
    
    // Tentar inserir na empresa_usuarios
    const { error: usuErr } = await supabase.from('empresa_usuarios').insert({
        auth_user_id: data.user.id,
        empresa_id: "00000000-0000-0000-0000-000000000000",
        email: email,
        nome: "Teste",
        papel: 'admin',
        status: 'ativo'
    });
    
    console.log("Insert empresa_usuarios error:", usuErr ? usuErr.message : "SUCESSO");
    
    // Cleanup with service role key
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
  }
}

run();
