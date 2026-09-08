import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  if (!supabaseAdmin) {
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: "Email ausente" });
    
    const { error } = await supabaseAdmin
      .from('user_presence')
      .upsert({ email: email.toLowerCase(), last_seen: new Date().toISOString() });
      
    if (error) throw error;
    
    return res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ erro: err.message });
  }
}
