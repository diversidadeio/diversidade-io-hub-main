import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Lê o arquivo .env.local manualmente para extrair as chaves (já que dotenv pode não estar disponível em escopo global)
const envFile = fs.readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
  const match = envFile.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cnpj = "42.591.651/2174-79";

async function run() {
  console.log(`Buscando empresa com CNPJ: ${cnpj}`);
  
  const { data: empresa, error: empErr } = await supabase
    .from('empresas')
    .select('id, email')
    .eq('cnpj', cnpj)
    .single();
    
  if (empErr) {
    console.log("Erro ao buscar empresa (pode não existir):", empErr.message);
  }
  
  if (empresa) {
    console.log("Empresa encontrada:", empresa.id);
    
    // Apagar empresa_usuarios
    await supabase.from('empresa_usuarios').delete().eq('empresa_id', empresa.id);
    console.log("Vínculos apagados.");
    
    // Apagar empresa
    await supabase.from('empresas').delete().eq('id', empresa.id);
    console.log("Empresa apagada da tabela 'empresas'.");
    
    // Apagar auth user se o email for retornado
    if (empresa.email) {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      if (usersData && usersData.users) {
        const user = usersData.users.find(u => u.email === empresa.email);
        if (user) {
          await supabase.auth.admin.deleteUser(user.id);
          console.log(`Usuário de autenticação deletado: ${user.email}`);
        }
      }
    }
  }

  // Deletar também o usuário de teste que o desenvolvedor tentou criar recentemente, para limpar geral
  const testEmails = [
    'tecnologia.diversidade+teste@gmail.com',
    'tecnologia.diversidade@gmail.com'
  ];

  const { data: usersData } = await supabase.auth.admin.listUsers();
  if (usersData && usersData.users) {
    for (const email of testEmails) {
      const user = usersData.users.find(u => u.email === email);
      if (user) {
        await supabase.auth.admin.deleteUser(user.id);
        console.log(`Usuário de autenticação deletado por segurança: ${email}`);
      }
    }
  }
  console.log("Limpeza concluída.");
}

run();
