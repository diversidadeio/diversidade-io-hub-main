const https = require('https');

const URL = 'ezvpveejlofauixfpizs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

function restGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: URL,
      path: path,
      method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function restDelete(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: URL,
      path: path,
      method: 'DELETE',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Buscando usuários...');
  let hasMore = true;
  let page = 1;
  let totalDeleted = 0;
  
  // Limpeza de usuários do Auth criados na última hora
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const r = await restGet('/auth/v1/admin/users');
  if (r.status !== 200) {
    console.error('Falha ao buscar usuários', r.body);
    return;
  }
  
  const users = r.body.users || r.body;
  if (!Array.isArray(users)) {
    console.error('Resposta inesperada:', users);
    return;
  }
  
  const recentes = users.filter(u => u.created_at > umaHoraAtras);
  console.log(`Encontrados ${recentes.length} usuários criados recentemente (de ${users.length} totais).`);
  
  for (const u of recentes) {
    console.log(`Deletando ${u.email}...`);
    const del = await restDelete(`/auth/v1/admin/users/${u.id}`);
    if (del.status === 200) totalDeleted++;
    else console.error(`Erro ao deletar ${u.email}:`, del.status, del.body);
  }
  
  console.log(`Limpeza concluída. ${totalDeleted} usuários deletados.`);
}

main().catch(console.error);
