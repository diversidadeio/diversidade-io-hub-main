const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });
require('dotenv').config({ path: 'client/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Variáveis de ambiente não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteLegacy() {
  const { data, error } = await supabase
    .from('solicitacoes_busca')
    .delete()
    .is('usuario_id', null);

  if (error) {
    console.error("Erro ao deletar:", error);
  } else {
    console.log("Solicitações legadas (sem usuário) deletadas com sucesso.");
  }
}
deleteLegacy();

