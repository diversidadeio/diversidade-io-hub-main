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
  console.log("Chamando RPC registrar_log_acesso diretamente com Service Role...");
  const { error } = await supabase.rpc("registrar_log_acesso", {
    p_email: "teste@script.com",
    p_tipo_evento: "teste_via_post",
    p_empresa_id: "6d8d5bae-87f1-47e7-95d0-a9ebc6afb8c0",
    p_nome_empresa: "Teste",
    p_executor_adm_email: null,
    p_ip_address: null,
    p_user_agent: null,
    p_detalhes: null
  });
  
  if (error) {
    console.log("Erro da RPC:", error.message);
  } else {
    console.log("RPC funcionou com sucesso!");
  }
}
run();
