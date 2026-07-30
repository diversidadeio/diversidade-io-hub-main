import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Configuração do Supabase ausente" });
  }

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "E-mail é obrigatório." });

    const { data: d1 } = await supabaseAdmin.from('empresas').select('id').eq('email', email).limit(1).maybeSingle();
    const { data: d2 } = await supabaseAdmin.from('empresa_usuarios').select('id').eq('email', email).limit(1).maybeSingle();
    const { data: d3 } = await supabaseAdmin.from('administradores').select('id').eq('email', email).limit(1).maybeSingle();

    if (d1 || d2 || d3) {
      return res.json({ existe: true });
    }

    return res.json({ existe: false });
  } catch (err: any) {
    console.error("Erro em /verificar-email:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
