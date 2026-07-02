/**
 * Script de análise: cruza o CSV de usuários do Bubble com a Empresa_diversidade
 * para identificar quantos usuários têm empresa cadastrada e quais campos se mapeiam.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'ezvpveejlofauixfpizs.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

// Lê o CSV
const csvPath = path.join(__dirname, '..', 'export_All-Users_2026-05-19_16-08-56.csv');
const csvLines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim());
const headers = csvLines[0].split(';');
const csvData = csvLines.slice(1).map(l => {
  const vals = l.split(';');
  const obj = {};
  headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
  return obj;
}).filter(r => r.email);

function fetchAll(tablePath, callback) {
  let allData = [];
  function fetchPage(offset) {
    const options = {
      hostname: SUPABASE_URL,
      path: tablePath + '?select=id&limit=1000&offset=' + offset,
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      const range = res.headers['content-range'] || '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const rows = JSON.parse(data);
        allData = allData.concat(rows);
        // Extrai total do content-range: "0-99/547"
        const match = range.match(/\/(\d+)$/);
        const total = match ? parseInt(match[1]) : 0;
        if (allData.length < total) {
          fetchPage(offset + 1000);
        } else {
          callback(allData);
        }
      });
    });
    req.on('error', e => console.error('Erro:', e.message));
    req.end();
  }
  fetchPage(0);
}

fetchAll('/rest/v1/Empresa_diversidade', (empresas) => {
  const idsNoBanco = new Set(empresas.map(e => e.id));
  const idsNoCSV = new Set(csvData.map(r => parseInt(r.id_empresa)).filter(Boolean));

  // --- Análise de cobertura ---
  let encontrados = 0;
  const naoEncontrados = [];
  idsNoCSV.forEach(id => {
    if (idsNoBanco.has(id)) encontrados++;
    else naoEncontrados.push(id);
  });

  const usuariosComEmpresa = csvData.filter(r => idsNoBanco.has(parseInt(r.id_empresa)));
  const usuariosSemEmpresa = csvData.filter(r => !idsNoBanco.has(parseInt(r.id_empresa)));

  // --- Empresas com múltiplos usuários ---
  const agrupado = {};
  csvData.forEach(r => {
    const id = r.id_empresa;
    if (!agrupado[id]) agrupado[id] = [];
    agrupado[id].push(r.email);
  });
  const empresasCompartilhadas = Object.entries(agrupado).filter(([id, emails]) => emails.length > 1);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         ANÁLISE DE CRUZAMENTO CSV x SUPABASE         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📋 Total de usuários no CSV:             ', csvData.length);
  console.log('🏢 IDs de empresa únicos no CSV:         ', idsNoCSV.size);
  console.log('');
  console.log('✅ IDs encontrados em Empresa_diversidade:', encontrados);
  console.log('❌ IDs NÃO encontrados:                  ', naoEncontrados.length);
  console.log('');
  console.log('👤 Usuários COM empresa no banco:        ', usuariosComEmpresa.length);
  console.log('👤 Usuários SEM empresa no banco:        ', usuariosSemEmpresa.length);
  console.log('');
  console.log('🏢 Empresas com 1 usuário (únicos):      ', Object.values(agrupado).filter(e => e.length === 1).length);
  console.log('🏢 Empresas com múltiplos usuários:      ', empresasCompartilhadas.length);
  console.log('');

  if (empresasCompartilhadas.length > 0) {
    console.log('--- Empresas compartilhadas (múltiplos logins) ---');
    empresasCompartilhadas.forEach(([id, emails]) => {
      console.log('  id_empresa=' + id + ' → ' + emails.length + ' usuários: ' + emails.join(', '));
    });
    console.log('');
  }

  if (naoEncontrados.length > 0) {
    console.log('--- Usuários sem empresa no banco ---');
    naoEncontrados.forEach(id => {
      const users = csvData.filter(r => parseInt(r.id_empresa) === id);
      users.forEach(u => {
        console.log('  id=' + id + ' | ' + u.email + ' | nome: ' + u.nome + ' | perfil: ' + u.Perfil);
      });
    });
  }
});
