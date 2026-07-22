import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach(line => {
  if (line.includes("=")) {
    const parts = line.split("=");
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim().replace(/^"|"$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || "";
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Buscando logs antigos de ADM...");
  
  // Buscar logs que sejam adm_ e que tenham executor_adm_email preenchido
  const { data: logs, error } = await supabase
    .from("logs_acesso")
    .select("*")
    .like("tipo_evento", "adm_%")
    .not("executor_adm_email", "is", null);

  if (error) {
    console.error("Erro:", error);
    return;
  }

  console.log(`Encontrados ${logs.length} logs de admin passíveis de correção.`);
  
  let atualizados = 0;
  
  for (const log of logs) {
    let detalheNovo = log.detalhes;
    
    // Gerar um detalhe legível caso esteja vazio
    if (!detalheNovo) {
        if (log.tipo_evento === 'adm_ver_empresa') detalheNovo = `Visualizou o cadastro da empresa: ${log.nome_empresa || log.email}`;
        else if (log.tipo_evento === 'adm_aprovar_empresa') detalheNovo = `Aprovou o cadastro da empresa: ${log.nome_empresa || log.email}`;
        else if (log.tipo_evento === 'adm_gerar_senha') detalheNovo = `Gerou uma nova senha temporária para a empresa: ${log.nome_empresa || log.email}`;
    }

    const { error: updErr } = await supabase
      .from("logs_acesso")
      .update({
        email: log.executor_adm_email,
        detalhes: detalheNovo
      })
      .eq("id", log.id);
      
    if (!updErr) {
      atualizados++;
    } else {
      console.error("Erro ao atualizar log ID:", log.id, updErr);
    }
  }
  
  console.log(`Sucesso: ${atualizados} logs foram corrigidos!`);
}

run();
