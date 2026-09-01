import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  if (!supabaseAdmin) {
    return res.status(500).json({ erro: "Configuração do banco de dados ausente." });
  }

  const empresaId = req.query?.empresaId as string;

  if (!empresaId) {
    return res.status(400).json({ erro: "empresaId é obrigatório." });
  }

  try {
    // Verifica se a empresa solicitante é incentivadora
    const { data: empresa, error: erroEmpresa } = await supabaseAdmin
      .from("empresas")
      .select("acesso_tipo")
      .eq("id", empresaId)
      .single();

    if (erroEmpresa || !empresa) {
      return res.status(404).json({ erro: "Empresa não encontrada." });
    }

    if (!empresa.acesso_tipo?.toUpperCase().includes("EMPRESA OU INICIATIVA INCENTIVADORA")) {
      return res.status(403).json({ erro: "Acesso não permitido para este tipo de empresa." });
    }

    // Busca as últimas 20 buscas da empresa, da mais recente para a mais antiga
    const { data: historico, error: erroHistorico } = await supabaseAdmin
      .from("historico_buscas_ia")
      .select("id, descricao, resultados, total_resultados, criado_em")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(20);

    if (erroHistorico) {
      console.error("[historico-buscas-ia] Erro ao buscar histórico:", erroHistorico);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    return res.json({ historico: historico || [] });
  } catch (err: any) {
    console.error("[historico-buscas-ia] Erro interno:", err);
    return res.status(500).json({ erro: "Erro interno. Tente novamente em instantes." });
  }
}
