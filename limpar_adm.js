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
  console.log("Buscando usuários tecnologia@diversidade.io...");
  const { data: users, error: findError } = await supabase
    .from("empresas")
    .select("*")
    .eq("email", "tecnologia@diversidade.io");

  if (findError) {
    console.error("Erro ao buscar usuário:", findError);
    return;
  }

  console.log(`Encontrados ${users.length} registros com esse email.`);
  
  for (const user of users) {
    console.log(`\nID: ${user.id} | Tipo: ${user.tipo_usuario}`);
    console.log(`Razão Social: ${user.razao_social} | Nome Fantasia: ${user.nome_fantasia}`);
    
    if (user.tipo_usuario === 'adm') {
      console.log("-> Limpando dados da empresa no registro ADM...");
      await supabase.from("empresas").update({
        razao_social: null,
        nome_fantasia: null,
        cnpj: null,
        acesso_tipo: null,
        area_empresa: null,
        area_geografica: null,
        sobre_empresa: null,
        emite_nota_fiscal: null,
        tem_conta_pj: null,
        formas_pagamento: null,
        formas_recebimento: null,
        e_socio: null,
        tem_negros_socios: null,
        autoriza_compartilhamento: null,
        diversidade_global: null,
        porte_empresa: null,
        atividade_empresarial: null,
        nome_responsavel: "Administrador do Sistema"
      }).eq("id", user.id);
      console.log("Registro ADM limpo.");
    } else {
      console.log("-> Removendo registro que não é ADM...");
      await supabase.from("empresas").delete().eq("id", user.id);
      console.log("Registro removido.");
    }
  }
}

run();
