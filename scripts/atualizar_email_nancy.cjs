/**
 * Script para atualizar o e-mail da usuária Nancy Campos
 * De: nancy.campos@nmeventos.com
 * Para: nancy.campos@nmcomunicacao.com.br
 */

const https = require('https');

// ─── Configuração ────────────────────────────────────────────
const SUPABASE_URL = 'ezvpveejlofauixfpizs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

const EMAIL_ANTIGO = 'nancy.campos@nmeventos.com';
const EMAIL_NOVO   = 'nancy.campos@nmcomunicacao.com.br';

// ─── Utilitários HTTP ─────────────────────────────────────────
function httpRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: d, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🔍 Buscando usuária com e-mail:', EMAIL_ANTIGO);

  // 1. Buscar o usuário pelo e-mail via Admin API
  const listResp = await httpRequest({
    hostname: SUPABASE_URL,
    path: `/auth/v1/admin/users?page=1&per_page=1000`,
    method: 'GET',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });

  if (listResp.status !== 200) {
    console.error('❌ Erro ao listar usuários:', listResp.status, listResp.body);
    process.exit(1);
  }

  const usuarios = listResp.body.users || [];
  console.log(`📋 Total de usuários encontrados: ${usuarios.length}`);

  const nancy = usuarios.find(u => u.email === EMAIL_ANTIGO);

  if (!nancy) {
    console.error(`❌ Usuária com e-mail "${EMAIL_ANTIGO}" não encontrada.`);
    // Verificar se o e-mail novo já existe
    const jaExiste = usuarios.find(u => u.email === EMAIL_NOVO);
    if (jaExiste) {
      console.log(`ℹ️  O e-mail "${EMAIL_NOVO}" já está cadastrado (ID: ${jaExiste.id})`);
    }
    process.exit(1);
  }

  console.log(`✅ Usuária encontrada:`);
  console.log(`   ID: ${nancy.id}`);
  console.log(`   E-mail atual: ${nancy.email}`);
  console.log(`   Nome: ${nancy.user_metadata?.nome || nancy.user_metadata?.full_name || 'N/A'}`);

  // 2. Atualizar o e-mail via Admin API
  console.log(`\n🔄 Atualizando e-mail para: ${EMAIL_NOVO}`);

  const updateResp = await httpRequest(
    {
      hostname: SUPABASE_URL,
      path: `/auth/v1/admin/users/${nancy.id}`,
      method: 'PUT',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    },
    { email: EMAIL_NOVO }
  );

  if (updateResp.status === 200) {
    console.log(`\n✅ E-mail atualizado com sucesso!`);
    console.log(`   De: ${EMAIL_ANTIGO}`);
    console.log(`   Para: ${EMAIL_NOVO}`);
  } else {
    console.error(`\n❌ Erro ao atualizar e-mail:`, updateResp.status, updateResp.body);
    process.exit(1);
  }

  // 3. Atualizar também na tabela `empresas` se o e-mail estiver lá
  console.log('\n🔄 Verificando tabela `empresas`...');
  const updateEmpresaResp = await httpRequest(
    {
      hostname: SUPABASE_URL,
      path: `/rest/v1/empresas?email=eq.${encodeURIComponent(EMAIL_ANTIGO)}`,
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    },
    { email: EMAIL_NOVO }
  );

  if (updateEmpresaResp.status === 200 && Array.isArray(updateEmpresaResp.body) && updateEmpresaResp.body.length > 0) {
    console.log(`✅ E-mail também atualizado na tabela \`empresas\` (${updateEmpresaResp.body.length} registro(s))`);
  } else if (updateEmpresaResp.status === 200 && Array.isArray(updateEmpresaResp.body) && updateEmpresaResp.body.length === 0) {
    console.log('ℹ️  Nenhum registro encontrado na tabela `empresas` com esse e-mail.');
  } else {
    console.warn('⚠️  Não foi possível verificar/atualizar a tabela `empresas`:', updateEmpresaResp.status, updateEmpresaResp.body);
  }

  console.log('\n🎉 Operação concluída!');
}

main().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
