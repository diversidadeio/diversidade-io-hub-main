import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  if (!supabaseAdmin) {
    console.error("[busca-ia] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    return res.status(500).json({ erro: "Configuração do banco de dados ausente." });
  }

  try {
    const { descricao, empresaId, isAdmin, adminEmail } = req.body;

    // Validações básicas
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 5) {
      return res.status(400).json({ erro: "Descreva com mais detalhes o que você precisa (mínimo 5 caracteres)." });
    }
    
    if (!isAdmin && !empresaId) {
      return res.status(400).json({ erro: "Empresa não identificada." });
    }

    let solicitanteEmail = adminEmail || "";

    // Verifica se a empresa solicitante é incentivadora (se não for admin)
    if (!isAdmin) {
      const { data: solicitante } = await supabaseAdmin
        .from("empresas")
        .select("acesso_tipo, razao_social, email")
        .eq("id", empresaId)
        .single();

      if (!solicitante?.acesso_tipo?.toUpperCase().includes("EMPRESA OU INICIATIVA INCENTIVADORA")) {
        return res.status(403).json({ erro: "Acesso não permitido para este tipo de empresa." });
      }
      solicitanteEmail = solicitante.email;
    }

    // ── Pré-filtragem por palavras-chave ──────────────────────────────────────
    const STOP_WORDS = new Set([
      "de", "da", "do", "das", "dos", "um", "uma", "uns", "umas", "o", "a", "os", "as",
      "para", "por", "com", "em", "no", "na", "nos", "nas", "e", "ou", "que", "se",
      "como", "mais", "mas", "ao", "aos", "à", "às", "pelo", "pela", "pelos", "pelas",
      "ser", "ter", "fazer", "meu", "minha", "seu", "sua", "preciso", "quero", "busco",
      "procuro", "estou", "estamos", "precisamos", "queremos",
    ]);

    const palavrasChave = descricao
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúàâêîôûãõüç\s]/gi, " ")
      .split(/\s+/)
      .filter((p: string) => p.length >= 3 && !STOP_WORDS.has(p));

    // Monta filtros OR para TODOS os campos textuais relevantes
    const camposTextuais = [
      "razao_social",
      "nome_fantasia",
      "area_empresa",
      "atividade_empresarial",
      "sobre_empresa",
      "area_geografica",
    ];

    // Etapa 1: campos principais (mais relevantes para identidade da empresa)
    const camposPrimarios = ["razao_social", "nome_fantasia", "area_empresa", "atividade_empresarial"];
    const filtrosPrimarios = palavrasChave.length > 0
      ? palavrasChave.flatMap((p: string) => camposPrimarios.map((c) => `${c}.ilike.%${p}%`)).join(",")
      : "";

    // Etapa 2 (ampliação): inclui sobre_empresa e area_geografica
    const filtrosTodos = palavrasChave.length > 0
      ? palavrasChave.flatMap((p: string) => camposTextuais.map((c) => `${c}.ilike.%${p}%`)).join(",")
      : "";

    const baseSelect = "id, razao_social, nome_fantasia, cnpj, email, nome_responsavel, atividade_empresarial, area_empresa, sobre_empresa, area_geografica";
    const aplicarFiltrosBase = (q: any) => {
      let query = q
        .eq("status_aprovacao", "aprovado")
        .neq("tipo_usuario", "adm")
        .eq("autoriza_compartilhamento", "Sim")
        .not("acesso_tipo", "ilike", "%EMPRESA OU INICIATIVA INCENTIVADORA%");
      
      if (empresaId) {
        query = query.neq("id", empresaId);
      }
      return query;
    };

    // Etapa 1: busca nos campos principais (razao_social, nome_fantasia, area_empresa, atividade_empresarial)
    let { data: empresasFiltradas, error: erroBusca } =
      palavrasChave.length > 0
        ? await aplicarFiltrosBase(supabaseAdmin.from("empresas").select(baseSelect)).or(filtrosPrimarios)
        : await aplicarFiltrosBase(supabaseAdmin.from("empresas").select(baseSelect));

    if (erroBusca) {
      console.error("[busca-ia] Erro ao buscar empresas:", erroBusca);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    // Etapa 2: se encontrou menos de 10, amplia para todos os campos de texto
    if (palavrasChave.length > 0 && (empresasFiltradas?.length ?? 0) < 10 && filtrosTodos) {
      const { data: empresasAmpladas } = await aplicarFiltrosBase(
        supabaseAdmin.from("empresas").select(baseSelect)
      ).or(filtrosTodos);

      const idsJaVistos = new Set((empresasFiltradas || []).map((e: any) => e.id));
      const extras = (empresasAmpladas || []).filter((e: any) => !idsJaVistos.has(e.id));
      empresasFiltradas = [...(empresasFiltradas || []), ...extras];
    }

    const empresas = empresasFiltradas || [];
    // ── Fim da pré-filtragem ──────────────────────────────────────────────────

    if (!empresas || empresas.length === 0) {
      return res.json({
        resultados: [],
        mensagem: "Nenhuma empresa cadastrada possui atividade relacionada ao que você descreveu.",
      });
    }

    console.log(`[busca-ia] Pré-filtro: ${empresas.length} candidatas para "${descricao.trim().slice(0, 60)}"`);

    // Verifica se a chave da OpenAI está configurada
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("[busca-ia] OPENAI_API_KEY não configurada nas variáveis de ambiente do Vercel.");
      return res.status(500).json({ erro: "Serviço de IA não configurado. Entre em contato com o suporte." });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Monta contexto completo das empresas para o prompt da IA
    const contextoEmpresas = empresas
      .map((e: any) => {
        const partes: string[] = [];
        partes.push(`ID:${e.id}`);
        partes.push(`${e.razao_social || ""}${e.nome_fantasia ? ` (${e.nome_fantasia})` : ""}`);
        partes.push(`Atividade/Área: ${e.atividade_empresarial || e.area_empresa || "N/A"}`);
        partes.push(`Sobre: ${e.sobre_empresa ? e.sobre_empresa.slice(0, 150) : "N/A"}`);
        partes.push(`Região: ${e.area_geografica || "N/A"}`);
        return partes.join(" | ");
      })
      .join("\n");

    // Prompt para o modelo
    const prompt = `Você é um assistente de matchmaking empresarial para a plataforma Diversidade.io.

TAREFA: Encontrar empresas cujos DADOS correspondam ao que o usuário precisa.

O usuário precisa de:
"${descricao.trim()}"

REGRAS OBRIGATÓRIAS — leia com atenção antes de responder:
1. Analise TODOS os campos disponíveis de cada empresa: nome (razão social e nome fantasia), atividade, área, descrição (sobre) e região.
2. Inclua uma empresa SOMENTE se houver correspondência DIRETA e REAL com o que o usuário precisa em qualquer um desses campos. Não invente, não suponha.
3. A justificativa deve mencionar QUAL campo evidenciou a correspondência (ex: "O nome fantasia indica...", "A atividade declarada é..."). NUNCA invente informações.
4. Se uma empresa é confeitaria, cabeleireiro, arquitetura ou qualquer área não relacionada ao pedido, NÃO a inclua.
5. Retorne até 10 empresas relevantes. Se houver menos, retorne apenas as que realmente correspondem. Se não houver nenhuma, retorne lista vazia.
6. Ordene da mais relevante para a menos relevante.

Formato de resposta (JSON válido, sem texto extra):
{
  "resultados": [
    { "id": "uuid-exato-da-lista", "justificativa": "Frase baseada nos dados reais da empresa (máx. 120 chars)" }
  ]
}

Lista de empresas (formato: ID | Nome (Nome Fantasia) | Atividade | Sobre | Região):
${contextoEmpresas}`;

    // Chama o GPT-4o-mini
    const resposta = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um sistema de matchmaking preciso. Retorne apenas JSON válido. Analise todos os campos disponíveis (nome, nome fantasia, atividade, área, sobre, região). Nunca inclua empresas que não sejam genuinamente relevantes. Nunca invente informações.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const conteudoResposta = resposta.choices[0]?.message?.content || "{}";
    let resultadosIA: { id: string; justificativa: string }[] = [];

    try {
      const parsed = JSON.parse(conteudoResposta);
      resultadosIA = parsed.resultados || [];
    } catch {
      console.error("[busca-ia] Erro ao parsear resposta da IA:", conteudoResposta);
      return res.status(500).json({ erro: "A IA retornou uma resposta inválida. Tente novamente." });
    }

    // Cruza os IDs da IA com os dados completos das empresas
    const mapaEmpresas = new Map(empresas.map((e: any) => [e.id, e]));
    const resultadosEnriquecidos = resultadosIA
      .filter((r) => mapaEmpresas.has(r.id))
      .slice(0, 10)
      .map((r) => {
        const empresa: any = mapaEmpresas.get(r.id);
        return {
          id: empresa.id,
          razao_social: empresa.razao_social,
          cnpj: empresa.cnpj,
          email: empresa.email,
          nome_responsavel: empresa.nome_responsavel,
          atividade_empresarial: empresa.atividade_empresarial || empresa.area_empresa,
          justificativa: r.justificativa,
        };
      });

    // Registra log de auditoria e salva no histórico de buscas IA
    try {
      await Promise.all([
        // Log de auditoria (logs_acesso)
        supabaseAdmin.from("logs_acesso").insert({
          empresa_id: isAdmin ? null : empresaId,
          email: solicitanteEmail,
          tipo_evento: "ia_busca_empresas",
          detalhes: `Busca: "${descricao.trim().slice(0, 200)}" | Resultados: ${resultadosEnriquecidos.length}`,
        }),
        // Histórico de buscas com resultados completos
        supabaseAdmin.from("historico_buscas_ia").insert({
          empresa_id: isAdmin ? null : empresaId,
          admin_email: isAdmin ? solicitanteEmail : null,
          descricao: descricao.trim(),
          resultados: resultadosEnriquecidos,
          total_resultados: resultadosEnriquecidos.length,
        }),
      ]);
    } catch (erroLog) {
      console.warn("[busca-ia] Falha ao registrar log/histórico:", erroLog);
    }

    return res.json({ resultados: resultadosEnriquecidos });
  } catch (err: any) {
    console.error("[busca-ia] Erro interno:", err);
    return res.status(500).json({ erro: "Erro interno. Tente novamente em instantes." });
  }
}
