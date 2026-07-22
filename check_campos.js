import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

const CAMPOS_OBRIGATORIOS = [
  "razao_social",
  "cnpj",
  "nome_responsavel",
  "telefone_principal",
  "area_empresa",
  "sobre_empresa",
  "logo_empresa_url",
];

const CAMPOS_SOCIO_OBRIGATORIOS = [
  "nome",
  "cpf",
  "email",
  "cep",
  "data_nascimento",
  "nacionalidade",
  "raca",
  "genero",
  "participacao_percentual",
  "participacao_valor",
];

async function check() {
  const cnpj = "54.193.390/0001-92";
  
  const { data: emp, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('cnpj', cnpj)
    .single();
    
  if (error || !emp) {
    console.error("Empresa não encontrada:", error);
    return;
  }
  
  console.log(`Verificando empresa: ${emp.razao_social}`);
  
  let faltantesEmpresa = [];
  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (emp[campo] == null || String(emp[campo]).trim() === "") {
      faltantesEmpresa.push(campo);
    }
  }
  
  if (faltantesEmpresa.length > 0) {
    console.log("Campos faltando na Empresa:", faltantesEmpresa);
  } else {
    console.log("Todos os campos obrigatórios da empresa estão preenchidos.");
  }
  
  const { data: socios } = await supabase
    .from('socios')
    .select('*')
    .eq('empresa_id', emp.id);
    
  if (!socios || socios.length === 0) {
    console.log("Nenhum sócio cadastrado (isso conta como faltando a etapa de sócios).");
  } else {
    console.log(`Encontrados ${socios.length} sócio(s).`);
    socios.forEach((socio, index) => {
      let faltantesSocio = [];
      for (const campo of CAMPOS_SOCIO_OBRIGATORIOS) {
        if (socio[campo] == null || String(socio[campo]).trim() === "") {
          faltantesSocio.push(campo);
        }
      }
      if (faltantesSocio.length > 0) {
        console.log(`Sócio ${index + 1} (${socio.nome || 'Sem nome'}) - Campos faltando:`, faltantesSocio);
      } else {
        console.log(`Sócio ${index + 1} (${socio.nome}) tem todos os campos preenchidos.`);
      }
    });
  }
}

check();
