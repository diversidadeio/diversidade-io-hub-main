import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envStr = fs.readFileSync(".env.local", "utf8");
const envVars = envStr.split("\n").reduce((acc, line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length) acc[key.trim()] = val.join("=").trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const supabaseUrl = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const cnpj = "42.274.696/0025-61";
  const { data: empresa, error } = await supabase.from('empresas').select('*').eq('cnpj', cnpj).single();
  if (error) {
    console.error("Erro ao buscar empresa:", error);
    return;
  }
  console.log("EMPRESA:");
  console.log("ID:", empresa.id);
  console.log("Email:", empresa.email);
  console.log("Responsavel:", empresa.nome_responsavel);

  const { data: usuarios, error: err2 } = await supabase.from('empresa_usuarios').select('*').eq('empresa_id', empresa.id);
  console.log("\nEMPRESA_USUARIOS:");
  console.log(usuarios);
}

check();
