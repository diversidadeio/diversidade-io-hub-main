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
// Using SERVICE_ROLE_KEY to bypass RLS
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checando logs_acesso no banco:");
  const { data, error } = await supabase.from("logs_acesso").select("*").limit(5);
  if (error) {
    console.error("Erro ao ler logs:", error);
  } else {
    console.log("Logs na tabela (bypass RLS):", data.length);
    console.log(data);
  }
  
  // E checando administradores
  const { data: admins } = await supabase.from("empresas").select("id, email, tipo_usuario").eq("tipo_usuario", "adm").limit(5);
  console.log("Admins:", admins);
}

run();
