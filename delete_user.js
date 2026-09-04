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

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const emailToDelete = "tecnologia+teste1@diversidade.io";
  console.log("Buscando usuário:", emailToDelete);

  // 1. Procurar no Auth
  const { data: authList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Erro listUsers:", listError);
    return;
  }
  
  const authUser = authList.users.find(u => u.email === emailToDelete);
  if (authUser) {
    console.log("Encontrado no Auth:", authUser.id);
    const { error: delError } = await supabase.auth.admin.deleteUser(authUser.id);
    if (delError) console.error("Erro deletando Auth:", delError);
    else console.log("Deletado do Auth!");
  } else {
    console.log("Não encontrado no Auth.");
  }

  // 2. Atualizar empresas.email (já que o "dono" deve ser o Admin real)
  const realEmail = "tecnologia+teste@diversidade.io";
  const { data: empresas, error: empError } = await supabase.from("empresas").update({ email: realEmail }).eq("email", emailToDelete).select();
  if (empError) {
    console.error("Erro atualizando empresas:", empError);
  } else {
    console.log("Empresas atualizadas:", empresas.length);
  }
}

run();
