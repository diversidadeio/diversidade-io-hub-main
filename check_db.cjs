const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'client/.env.local' });
require('dotenv').config({ path: 'client/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Variáveis de ambiente não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('solicitacoes_busca').select('id, empresa_id, usuario_id, cidade, cnaes, criado_em');
  if (error) {
    console.error("Erro:", error);
  } else {
    console.log("Solicitações:");
    data.forEach(d => console.log(`- ${d.id} | usuario_id: ${d.usuario_id} | cidade: ${d.cidade} | criado_em: ${d.criado_em}`));
  }
}
check();
