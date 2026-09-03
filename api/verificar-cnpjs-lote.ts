import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function limparCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function normalizarSituacaoCNPJ(situacaoOriginal?: string): string {
  if (!situacaoOriginal) return "NAO_ENCONTRADO";
  const s = situacaoOriginal.toUpperCase().trim();
  switch (s) {
    case "ATIVA":
      return "ATIVA";
    case "INAPTA":
      return "INAPTA";
    case "BAIXADA":
      return "BAIXADA";
    case "SUSPENSA":
      return "SUSPENSA";
    case "NULA":
      return "NULA";
    default:
      return "NAO_ENCONTRADO";
  }
}



export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ erro: "Configuração do banco de dados ausente." });
  }

  // Cabeçalhos SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emitir = (evento: string, dados: object) => {
    res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
    if (res.flush) res.flush();
  };

  try {
    const idsParam = (req.query.ids as string) || "";
    const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);

    if (ids.length === 0) {
      emitir("erro", { mensagem: "Nenhuma empresa selecionada." });
      return res.end();
    }

    const { data: empresas, error: fetchError } = await supabaseAdmin
      .from("empresas")
      .select("id, razao_social, cnpj")
      .in("id", ids)
      .neq("tipo_usuario", "adm");

    if (fetchError || !empresas) {
      emitir("erro", { mensagem: "Erro ao buscar empresas no banco." });
      return res.end();
    }

    const total = empresas.length;
    const resumo: Record<string, number> = {};

    for (let i = 0; i < empresas.length; i++) {
      if (req.socket.destroyed) break;

      const empresa = empresas[i];
      const cnpjLimpo = limparCNPJ(empresa.cnpj || "");
      let situacao = "CNPJ_INVALIDO";

      if (cnpjLimpo.length === 14) {
        try {
          const resposta: any = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
            headers: { "Accept": "application/json", "User-Agent": "diversidade.io/1.0" },
            signal: AbortSignal.timeout(15000),
          });

          if (resposta.ok) {
            const dados = (await resposta.json()) as any;
            situacao = normalizarSituacaoCNPJ(dados?.descricao_situacao_cadastral);
          } else if (resposta.status === 404) {
            situacao = "NAO_ENCONTRADO";
          } else if (resposta.status === 429) {
            situacao = "RATE_LIMIT";
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (err: any) {
          situacao = "ERRO_CONSULTA";
        }
      }

      const verificadoEm = new Date().toISOString();
      await supabaseAdmin
        .from("empresas")
        .update({
          situacao_cnpj: situacao,
          situacao_cnpj_verificado_em: verificadoEm,
        })
        .eq("id", empresa.id);

      resumo[situacao] = (resumo[situacao] || 0) + 1;

      emitir("progresso", {
        empresa_id: empresa.id,
        razao_social: empresa.razao_social,
        cnpj: empresa.cnpj,
        situacao,
        verificado_em: verificadoEm,
        atual: i + 1,
        total,
      });

      if (i < empresas.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
    }

    emitir("concluido", { total, resumo });
    res.end();
  } catch (err: any) {
    console.error("Erro no endpoint /verificar-cnpjs-lote:", err);
    emitir("erro", { mensagem: "Erro interno do servidor." });
    res.end();
  }
}
