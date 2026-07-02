/**
 * ============================================================
 * SCRIPT DE MIGRAÇÃO: Bubble → Supabase (Diversidade.io Hub)
 * ============================================================
 * 
 * O que este script faz:
 *  1. Lê o CSV com 576 usuários do Bubble
 *  2. Para cada usuário, busca os dados em Empresa_diversidade (por id_empresa)
 *     e em Socios_diversidade (por id_empresa)
 *  3. Monta o objeto completo mapeado para a nova tabela `empresas`
 *  4. Cria o usuário no Supabase Auth (sem senha — via Admin API)
 *  5. Insere na tabela `empresas` com senha_temporaria = true
 *  6. Para empresas compartilhadas (mesmo id_empresa), cria a empresa uma vez
 *     e linka os usuários subsequentes ao mesmo registro
 * 
 * Uso:
 *   node scripts/migrar_usuarios.cjs              → migração completa
 *   node scripts/migrar_usuarios.cjs --dry-run    → valida sem inserir nada
 *   node scripts/migrar_usuarios.cjs --limit 5    → testa com os 5 primeiros
 * 
 * Logs gerados em: scripts/logs/migracao_YYYYMMDD_HHMMSS.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Configuração ────────────────────────────────────────────
const SUPABASE_URL = 'ezvpveejlofauixfpizs.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc1OTc0NjksImV4cCI6MjAzMTczNDY5fQ.n7OTCDXlmLzdwIAaUwjxV3lp0qHzD33m608PKmuz7sc';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6dnB2ZWVqbG9mYXVpeGZwaXpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzU5NzQ2OSwiZXhwIjoyMDMzMTczNDY5fQ.IuaIRVopYaCfnjLCsLATpMpUH68ktUD_i6giR3Jnlhc';

const CSV_PATH = path.join(__dirname, '..', 'export_All-Users_2026-05-19_16-08-56.csv');
const LOG_DIR  = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT   = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i+1]) : null; })();
const COMPANY = (() => { const i = process.argv.indexOf('--company'); return i >= 0 ? parseInt(process.argv[i+1]) : null; })();

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

function restGet(path, key = SERVICE_KEY) {
  return httpRequest({
    hostname: SUPABASE_URL, path,
    method: 'GET',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }
  });
}

function restPost(path, data, key = SERVICE_KEY) {
  const body = JSON.stringify(data);
  return httpRequest({
    hostname: SUPABASE_URL, path,
    method: 'POST',
    headers: {
      'apikey': key, 'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
}

// ─── Leitura e cache completo das tabelas do Bubble ───────────
async function carregarTodasEmpresas() {
  console.log('⏳ Carregando Empresa_diversidade...');
  let todas = [], offset = 0;
  while (true) {
    const r = await restGet(`/rest/v1/Empresa_diversidade?limit=1000&offset=${offset}&order=id`);
    if (!Array.isArray(r.body) || r.body.length === 0) break;
    todas = todas.concat(r.body);
    const total = parseInt((r.headers['content-range'] || '').match(/\/(\d+)$/)?.[1] || '0');
    if (todas.length >= total || r.body.length < 1000) break;
    offset += 1000;
  }
  const map = {};
  todas.forEach(e => { map[e.id] = e; });
  console.log(`  ✅ ${todas.length} empresas carregadas`);
  return map;
}

async function carregarTodosSocios() {
  console.log('⏳ Carregando Socios_diversidade...');
  let todos = [], offset = 0;
  while (true) {
    const r = await restGet(`/rest/v1/Socios_diversidade?limit=1000&offset=${offset}&order=id_empresa`);
    if (!Array.isArray(r.body) || r.body.length === 0) break;
    todos = todos.concat(r.body);
    const total = parseInt((r.headers['content-range'] || '').match(/\/(\d+)$/)?.[1] || '0');
    if (todos.length >= total || r.body.length < 1000) break;
    offset += 1000;
  }
  const map = {};
  todos.forEach(s => { 
    const id = s.id_empresa;
    if (!map[id]) map[id] = [];
    map[id].push(s);
  });
  console.log(`  ✅ ${todos.length} sócios carregados (${Object.keys(map).length} empresas únicas)`);
  return map;
}

// ─── Mapeamento de campos ─────────────────────────────────────
function mapearAcessoTipo(tipoEmpresa) {
  const t = (tipoEmpresa || '').trim();
  if (t === 'Empreendedores' || t === 'Empreendedores\r') return 'EMPREENDIMENTO DIVERSO';
  if (t === 'Empresa inclusiva' || t === 'Empresa Inclusiva') return 'EMPRESA OU INICIATIVA INCENTIVADORA';
  if (t === 'Empresas com Repr. Vendas negros') return 'EMPRESA OU INICIATIVA INCENTIVADORA';
  return '';
}

function normalizarSim(valor) {
  const v = (valor || '').toLowerCase().trim();
  return v === 'sim' ? 'Sim' : v === 'não' || v === 'nao' ? 'Não' : 'Não';
}

function normalizarFormas(v) {
  if (!v || v.trim() === '') return [];
  const partes = v.split(',').map(s => s.trim()).filter(Boolean);
  return partes;
}

function montarEndereco(e) {
  const partes = [
    e['rua'], e['Número endereço'] ? `nº ${e['Número endereço']}` : null,
    e['complemento'] || null
  ].filter(Boolean);
  return partes.join(', ') || null;
}

// URL CDN Bubble — acrescenta https: se necessário
const fixUrl = (u) => {
  if (!u || u.trim() === '') return null;
  return u.startsWith('//') ? 'https:' + u : u;
};

function montarRegistroEmpresa(csvUser, empresa, socios) {
  const e = empresa || {};
  const s = socios && socios.length > 0 ? socios[0] : {}; // Usa o primeiro sócio para dados complementares do responsável

  const nomeResponsavel =
    (e['nome do responsavel'] || '').trim() ||
    (s['Nome'] || '').trim() ||
    (e['ADM empresa'] || '').trim() ||
    (csvUser.nome || '').trim() || null;

  const acesso_tipo = mapearAcessoTipo(e['Tipo empresa']);

  const diversidade_global = s['id_empresa'] ? {
    sexo:             s['Sexo']             || null,
    raca:             s['Raça']             || null,
    genero:           s['Genero']           || null,
    orientacao:       s['orientacao']       || null,
    pcd:              s['PCD']              || null,
    pcd_auditiva:     s['PCD_auditiva']     || null,
    pcd_fisico:       s['PCD_fisico']       || null,
    pcd_inteletual:   s['PCD_inteletual']   || null,
    pcd_psicossocial: s['PCD _psicossocial']|| null,
    pcd_visual:       s['PCD _visual']      || null,
    pcd_descricao:    s['PCD_descrição']    || null,
    imigrante:        s['imigrante']        || null,
    militar_veterano: s['militar_vetarano'] || null,
    recorte:          s['recorte_dadiversidade'] || null,
  } : null;

  return {
    // Acesso e identidade
    email:                   csvUser.email,
    nome_responsavel:        nomeResponsavel || '(Não informado)',
    senha_hash:              'MIGRATION_PENDING_PASSWORD',
    tipo_usuario:            'empresa',
    senha_temporaria:        true,
    acesso_tipo:             acesso_tipo || 'EMPREENDIMENTO DIVERSO',

    // Dados da empresa
    razao_social:            e['RAZAO_SOCIAL']        || '(Não informado)',
    nome_fantasia:           e['Nome fantasia']       || null,
    cnpj:                    e['CNPJ']                || '00.000.000/0000-00',
    porte_empresa:           e['Porte_empresa']       || null,
    atividade_empresarial:   e['Atividade_empresarial'] || null,
    area_empresa:            e['Area_empresa']        || '(Não informado)',
    area_geografica:         e['Area_atendimento']    || '(Não informado)',
    sobre_empresa:           e['Sobre a empresa']     || null,

    // Contato
    telefone_principal:      (e['Telefone'] || s['Telefone'] || '').trim() || '(Não informado)',
    telefone_opcional:       (e['Telefone fixo'] || '').trim() || null,

    // Operacional
    emite_nota_fiscal:       normalizarSim(e['emite_nota_fiscal']) || 'Não',
    tem_conta_pj:            normalizarSim(e['conta_bancaria_pj']) || 'Não',
    formas_pagamento:        normalizarFormas(e['Formas de pagamento']),
    formas_recebimento:      normalizarFormas(e['Formas de recebimento']),
    e_socio:                 normalizarSim(e['voce_e_socio?']) || 'Não',
    tem_negros_socios:       normalizarSim(e['empresa_tem_socios_negros']) || 'Não',
    autoriza_compartilhamento: normalizarSim(e['autoriza_seus_dados']) || 'Sim',

    // Diversidade
    diversidade_global:      diversidade_global,

    // Documentos e mídias
    foto_responsavel_url:    fixUrl(s['Foto'] || csvUser['Foto'] || null),
    logo_empresa_url:        fixUrl(e['logo']),
    cartao_cnpj_url:         fixUrl(e['CNPJ PDF']),
    ficha_junta_url:         fixUrl(e['ficha_junta_comercial']),
  };
}

function montarRegistrosSocios(empresa_id_uuid, sociosBubble) {
  if (!sociosBubble || sociosBubble.length === 0) return [];
  return sociosBubble.map(socio => ({
    empresa_id:              empresa_id_uuid,
    nome:                    socio['Nome'] || '(Não informado)',
    cpf:                     socio['CPF'] || '000.000.000-00',
    email:                   socio['Email'] || null,
    participacao_percentual: String(socio['participação'] || ''),
    participacao_valor:      String(socio['participação'] || ''),
    data_nascimento:         socio['Data nascimento'] || null,
    nacionalidade:           socio['Nacionalidade'] || null,
    etariedade:              socio['Etariedade'] || null,
    raca:                    socio['Raça'] || null,
    sexo:                    socio['Sexo'] || null,
    genero:                  socio['Genero'] || null,
    orientacao:              socio['orientacao'] || null,
    
    // Deficiência detalhada
    deficiencia:                   socio['PCD'] || null,
    deficiencia_auditiva_grau:     socio['PCD_auditiva'] || null,
    deficiencia_fisica_grau:       socio['PCD_fisico'] || null,
    deficiencia_intelectual_grau:  socio['PCD_inteletual'] || null,
    deficiencia_psicossocial_grau: socio['PCD _psicossocial'] || null,
    deficiencia_visual_grau:       socio['PCD _visual'] || null,

    foto_url:                fixUrl(socio['Foto']),
    fonte_imagem:            socio['Fonte_imagem'] || null,
  }));
}


// ─── Ações no Supabase ────────────────────────────────────────
async function criarUsuarioAuth(email, nomeResponsavel) {
  const r = await restPost('/auth/v1/admin/users', {
    email,
    email_confirm: true,
    user_metadata: { nome_responsavel: nomeResponsavel }
  });
  if (r.status === 200 || r.status === 201) return r.body.id;
  if (r.status === 422 && JSON.stringify(r.body).includes('already')) return 'JA_EXISTE';
  throw new Error(`Auth falhou (${r.status}): ${JSON.stringify(r.body)}`);
}

async function buscarUsuarioAuthPorEmail(email) {
  // Não há endpoint REST simples para buscar por email sem MCP/admin
  // Vamos inserir e tratar o conflito na tabela empresas
  return null;
}

async function inserirEmpresa(dados) {
  const r = await restPost('/rest/v1/empresas', dados);
  if (r.status === 201) return Array.isArray(r.body) ? r.body[0] : r.body;
  if (r.status === 409) return 'DUPLICADO';
  throw new Error(`Insert falhou (${r.status}): ${JSON.stringify(r.body).substring(0, 300)}`);
}

async function inserirSocios(dadosSocios) {
  if (!dadosSocios || dadosSocios.length === 0) return;
  const r = await restPost('/rest/v1/socios', dadosSocios);
  if (r.status !== 201) {
    throw new Error(`Insert sócios falhou (${r.status}): ${JSON.stringify(r.body).substring(0, 300)}`);
  }
}

// ─── Execução Principal ───────────────────────────────────────
async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const logPath = path.join(LOG_DIR, `migracao_${timestamp}.json`);
  const log = { inicio: new Date().toISOString(), dry_run: DRY_RUN, registros: [] };

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     MIGRAÇÃO: Bubble → Supabase (Diversidade.io)     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('🔍 MODO DRY-RUN — nenhum dado será inserido\n');

  // 1. Carrega CSV
  const csvLines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(l => l.trim());
  const headers = csvLines[0].split(';');
  let usuarios = csvLines.slice(1).map(l => {
    const vals = l.split(';');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
    return obj;
  }).filter(r => r.email && r.id_empresa);

  if (COMPANY) usuarios = usuarios.filter(u => parseInt(u.id_empresa) === COMPANY);
  if (LIMIT) usuarios = usuarios.slice(0, LIMIT);
  console.log(`📋 Usuários a processar: ${usuarios.length}${LIMIT ? ` (limitado a ${LIMIT})` : ''}${COMPANY ? ` (empresa ${COMPANY})` : ''}\n`);

  // 2. Carrega tabelas do Bubble em memória (uma só requisição)
  const empresasMap = await carregarTodasEmpresas();
  const sociosMap   = await carregarTodosSocios();

  // 3. Rastreia empresas já criadas (para empresas compartilhadas)
  const empresasJaCriadas = {}; // id_empresa → empresa_id (uuid no novo banco)

  let ok = 0, erros = 0, pulados = 0, jaExistia = 0;

  for (const csvUser of usuarios) {
    const idEmpresa = parseInt(csvUser.id_empresa);
    const empresa   = empresasMap[idEmpresa] || null;
    const socios    = sociosMap[idEmpresa]   || [];

    const registro = { email: csvUser.email, id_empresa: idEmpresa, status: null, erro: null, socios_inseridos: 0 };

    try {
      const dadosEmpresa = montarRegistroEmpresa(csvUser, empresa, socios);

      if (DRY_RUN) {
        console.log(`✔ [DRY-RUN] ${csvUser.email} | empresa: ${dadosEmpresa.razao_social || '(sem empresa)'} | acesso: ${dadosEmpresa.acesso_tipo} | porte: ${dadosEmpresa.porte_empresa} | sócios: ${socios.length}`);
        registro.status = 'dry_run';
        registro.dados_mapeados = dadosEmpresa;
        registro.socios_mapeados = montarRegistrosSocios('uuid-falso-dry-run', socios);
        ok++;
      } else {
        // 4a. Se empresa compartilhada já foi criada, só cria o usuário Auth
        if (empresasJaCriadas[idEmpresa]) {
          const userId = await criarUsuarioAuth(csvUser.email, dadosEmpresa.nome_responsavel);
          if (userId === 'JA_EXISTE') { registro.status = 'usuario_ja_existe'; jaExistia++; }
          else { registro.status = 'usuario_vinculado_empresa_existente'; ok++; }
          registro.empresa_id = empresasJaCriadas[idEmpresa];
          console.log(`  🔗 ${csvUser.email} → vinculado à empresa id_empresa=${idEmpresa}`);
        } else {
          // 4b. Cria usuário no Auth
          const userId = await criarUsuarioAuth(csvUser.email, dadosEmpresa.nome_responsavel);
          if (userId === 'JA_EXISTE') {
            console.log(`  ⚠️  ${csvUser.email} — já existe no Auth, pulando inserção`);
            registro.status = 'usuario_ja_existe';
            jaExistia++;
          } else {
            // 4c. Cria empresa com user_id
            dadosEmpresa.id = userId; // ID da empresa será o UUID do Auth
            const empresaCriada = await inserirEmpresa(dadosEmpresa);
            if (empresaCriada === 'DUPLICADO') {
              registro.status = 'empresa_duplicada';
              pulados++;
            } else {
              empresasJaCriadas[idEmpresa] = empresaCriada?.id || true;
              registro.empresa_id = empresaCriada?.id;
              
              // 4d. Insere sócios
              if (socios.length > 0 && empresaCriada?.id) {
                const dadosSocios = montarRegistrosSocios(empresaCriada.id, socios);
                await inserirSocios(dadosSocios);
                registro.socios_inseridos = dadosSocios.length;
              }

              registro.status = 'criado';
              ok++;
              console.log(`  ✅ ${csvUser.email} | ${dadosEmpresa.razao_social || '(sem empresa)'} | ${registro.socios_inseridos} sócio(s)`);
            }
          }
        }
      }
    } catch (err) {
      registro.status = 'erro';
      registro.erro = err.message;
      erros++;
      console.error(`  ❌ ${csvUser.email}: ${err.message}`);
    }

    log.registros.push(registro);
  }

  // 5. Resumo
  log.fim = new Date().toISOString();
  log.resumo = { total: usuarios.length, ok, erros, pulados, ja_existia: jaExistia };
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  console.log('\n╔══════════════════ RESUMO ══════════════════╗');
  console.log(`  Total processados:   ${usuarios.length}`);
  console.log(`  ✅ Criados com sucesso: ${ok}`);
  console.log(`  ⚠️  Já existiam:       ${jaExistia}`);
  console.log(`  ⏭️  Pulados (duplic.): ${pulados}`);
  console.log(`  ❌ Erros:             ${erros}`);
  console.log(`  📄 Log salvo em:      ${logPath}`);
  console.log('╚════════════════════════════════════════════╝\n');
}

main().catch(err => { console.error('ERRO FATAL:', err.message); process.exit(1); });
