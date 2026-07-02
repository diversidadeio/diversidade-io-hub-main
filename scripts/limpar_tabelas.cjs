const https = require('https');

const URL = 'ezvpveejlofauixfpizs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

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
  console.log('Deletando socios recentes...');
  const umaHoraAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  let r = await restDelete(`/rest/v1/socios?created_at=gt.${umaHoraAtras}`);
  console.log('Socios deletados:', r.status);

  console.log('Deletando empresas recentes...');
  r = await restDelete(`/rest/v1/empresas?created_at=gt.${umaHoraAtras}`);
  console.log('Empresas deletadas:', r.status);
}

main().catch(console.error);
