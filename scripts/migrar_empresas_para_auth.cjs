const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carrega as variáveis de ambiente do .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'] || envVars['SUPABASE_URL'];
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local.");
  process.exit(1);
}

// Cria um cliente com privilégios de Service Role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Senha padrão aleatória (o usuário terá que usar 'Esqueci minha senha' de qualquer forma)
const GERAR_SENHA_ALEATORIA = () => Math.random().toString(36).slice(-12) + "A!1a";

async function migrar() {
  console.log("Iniciando migração de empresas para o Supabase Auth...");

  // 1. Busca todas as empresas
  const { data: empresas, error: empresasError } = await supabase
    .from('empresas')
    .select('id, email, nome_responsavel');

  if (empresasError) {
    console.error("Erro ao buscar empresas:", empresasError);
    return;
  }

  console.log(`Encontradas ${empresas.length} empresas. Processando...`);

  let sucessoCount = 0;
  let erroCount = 0;

  for (const empresa of empresas) {
    try {
      if (!empresa.email) continue;
      
      // Cria o usuário no auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: empresa.email,
        password: GERAR_SENHA_ALEATORIA(),
        email_confirm: true // Já confirma o e-mail para não precisar de verificação
      });

      if (authError) {
        if (authError.message.includes('already exists') || authError.status === 422) {
          console.log(`[SKIPPED] Usuário já existe no Auth: ${empresa.email}`);
        } else {
          console.error(`[ERRO] Falha ao criar usuário Auth para ${empresa.email}:`, authError.message);
          erroCount++;
        }
        continue;
      }

      console.log(`[OK] Usuário Auth criado: ${empresa.email}`);
      
      // A trigger "on_auth_user_created" criada no banco cuidará de inserir o vínculo
      // na tabela "empresa_usuarios", então não precisamos fazer isso via script.
      sucessoCount++;

    } catch (err) {
      console.error(`[EXCEÇÃO] Erro processando ${empresa.email}:`, err);
      erroCount++;
    }
  }

  console.log("\n--- Resumo da Migração ---");
  console.log(`Sucesso: ${sucessoCount}`);
  console.log(`Erros: ${erroCount}`);
  console.log("--------------------------\n");
}

migrar();
