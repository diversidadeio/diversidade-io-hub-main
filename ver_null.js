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
  const { data: logs, error } = await supabase
    .from("logs_acesso")
    .select("*")
    .like("tipo_evento", "adm_%")
    .is("executor_adm_email", null);

  if (error) {
    console.error("Erro:", error);
    return;
  }
  
  console.log("Logs não corrigidos (executor null):", logs.length);
  if (logs.length > 0) {
      console.log(logs.slice(0, 5));
  }
}

run();
