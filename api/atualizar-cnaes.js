import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  let supabaseAdmin = null;
  if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  } else {
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  try {
    const { empresa_id, cnpj } = req.body;
    if (!empresa_id || !cnpj) {
      return res.status(400).json({ erro: "empresa_id e cnpj são obrigatórios." });
    }

    const cnpjLimpo = cnpj.replace(/[^\d]/g, "");
    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ erro: "CNPJ inválido (deve ter 14 dígitos)." });
    }

    // Consulta a BrasilAPI
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { "Accept": "application/json", "User-Agent": "diversidade.io/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resposta.ok) {
      return res.status(resposta.status).json({ erro: "Erro ao consultar CNPJ na BrasilAPI." });
    }

    const dados = await resposta.json();
    
    // Formatar CNAEs
    const cnaes = [];
    if (dados.cnae_fiscal && dados.cnae_fiscal_descricao) {
        cnaes.push(`${dados.cnae_fiscal} - ${dados.cnae_fiscal_descricao}`);
    } else if (dados.cnae_fiscal) {
        cnaes.push(dados.cnae_fiscal.toString());
    }
    
    if (dados.cnaes_secundarios && Array.isArray(dados.cnaes_secundarios)) {
        dados.cnaes_secundarios.forEach((cnae) => {
            if (cnae.codigo && cnae.descricao) {
                cnaes.push(`${cnae.codigo} - ${cnae.descricao}`);
            } else if (cnae.codigo) {
                cnaes.push(cnae.codigo.toString());
            }
        });
    }

    const cnaesFormatados = cnaes.join(", ");

    if (!cnaesFormatados) {
        return res.status(404).json({ erro: "Nenhum CNAE encontrado para este CNPJ." });
    }

    // Salva no banco
    const { error: updateError } = await supabaseAdmin
      .from("empresas")
      .update({
        atividade_empresarial: cnaesFormatados,
      })
      .eq("id", empresa_id);

    if (updateError) {
      console.error("Erro ao salvar CNAEs:", updateError);
      return res.status(500).json({ erro: "Erro ao salvar resultado no banco." });
    }

    return res.json({ cnaes: cnaesFormatados });
  } catch (err) {
    console.error("Erro no endpoint /atualizar-cnaes:", err);
    return res.status(500).json({ erro: "Erro interno ao atualizar CNAEs." });
  }
}
