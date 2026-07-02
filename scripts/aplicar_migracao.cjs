/**
 * Aplica migrações DDL no Supabase via Management API (v1)
 * Usa o endpoint /query que aceita SQL livre com service role key
 */
const https = require('https');

const PROJECT_REF = 'ezvpveejlofauixfpizs';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

function execSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    // Tenta a rota de query direta do PostgREST com service role
    // PostgREST com service role aceita qualquer SQL via /sql endpoint no Supabase v2
    const options2 = {
      hostname: `db.${PROJECT_REF}.supabase.co`,
      path: '/rest/v1/',
      method: 'POST',
    };

    // Usa o endpoint correto: Supabase permite DDL via HTTP POST para /sql com service key
    const optsDDL = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(optsDDL, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const migracoes = [
  {
    nome: 'Adicionar porte_empresa',
    sql: `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS porte_empresa TEXT`
  },
  {
    nome: 'Adicionar atividade_empresarial',
    sql: `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS atividade_empresarial TEXT`
  }
];

(async () => {
  for (const m of migracoes) {
    console.log(`\nExecutando: ${m.nome}`);
    const result = await execSQL(m.sql);
    console.log(`  Status: ${result.status}`);
    console.log(`  Resp:   ${result.body.substring(0, 300)}`);
  }
})();
