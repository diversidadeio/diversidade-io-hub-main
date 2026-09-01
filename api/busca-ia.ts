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
    const { descricao, empresaId } = req.body;

    // Validações básicas
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 5) {
      return res.status(400).json({ erro: "Descreva com mais detalhes o que você precisa (mínimo 5 caracteres)." });
    }
    if (!empresaId) {
      return res.status(400).json({ erro: "Empresa não identificada." });
    }

    // Verifica se a empresa solicitante é incentivadora
    const { data: solicitante } = await supabaseAdmin
      .from("empresas")
      .select("acesso_tipo, razao_social, email")
      .eq("id", empresaId)
      .single();

    if (!solicitante?.acesso_tipo?.toUpperCase().includes("EMPRESA OU INICIATIVA INCENTIVADORA")) {
      return res.status(403).json({ erro: "Acesso não permitido para este tipo de empresa." });
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
      .filter((p: string) => p.length >= 4 && !STOP_WORDS.has(p));

    const filtrosAtividade = palavrasChave.map((p: string) => `atividade_empresarial.ilike.%${p}%`).join(",");
    const filtrosSobre = palavrasChave.map((p: string) => `sobre_empresa.ilike.%${p}%`).join(",");

    const baseSelect = "id, razao_social, cnpj, email, nome_responsavel, atividade_empresarial, area_empresa, sobre_empresa";
    const aplicarFiltrosBase = (q: any) =>
      q
        .eq("status_aprovacao", "aprovado")
        .neq("tipo_usuario", "adm")
        .eq("autoriza_compartilhamento", "Sim")
        .not("acesso_tipo", "ilike", "%EMPRESA OU INICIATIVA INCENTIVADORA%")
        .neq("id", empresaId);

    // Etapa 1: busca por palavras-chave na atividade empresarial
    let { data: empresasFiltradas, error: erroBusca } =
      palavrasChave.length > 0
        ? await aplicarFiltrosBase(supabaseAdmin.from("empresas").select(baseSelect)).or(filtrosAtividade)
        : await aplicarFiltrosBase(supabaseAdmin.from("empresas").select(baseSelect));

    if (erroBusca) {
      console.error("[busca-ia] Erro ao buscar empresas:", erroBusca);
      return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
    }

    // Etapa 2: se encontrou menos de 5, amplia para sobre_empresa também
    if (palavrasChave.length > 0 && (empresasFiltradas?.length ?? 0) < 5 && filtrosSobre) {
      const { data: empresasAmpladas } = await aplicarFiltrosBase(
        supabaseAdmin.from("empresas").select(baseSelect)
      ).or(`${filtrosAtividade},${filtrosSobre}`);

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

    // Monta contexto compacto das empresas para o prompt
    const contextoEmpresas = empresas
      .map((e: any) => {
        const atividade = e.atividade_empresarial || e.area_empresa || "Não informado";
        const sobre = e.sobre_empresa ? e.sobre_empresa.slice(0, 100) : "";
        return `ID:${e.id} | ${e.razao_social} | Atividade: ${atividade}${sobre ? " | Sobre: " + sobre : ""}`;
      })
      .join("\n");

    // Prompt para o modelo
    const prompt = `Você é um assistente de matchmaking empresarial para a plataforma Diversidade.io.

TAREFA: Encontrar empresas cujas ATIVIDADES REAIS correspondam ao que o usuário precisa.

O usuário precisa de:
"${descricao.trim()}"

REGRAS OBRIGATÓRIAS — leia com atenção antes de responder:
1. Analise o campo "atividade" de cada empresa na lista abaixo.
2. Inclua uma empresa SOMENTE se a atividade dela tiver correspondência DIRETA e REAL com o que o usuário precisa. Não invente, não suponha.
3. A justificativa deve ser baseada EXCLUSIVAMENTE no texto da atividade da empresa. NUNCA invente serviços que a empresa não declarou.
4. Se uma empresa é confeitaria, cabeleireiro, arquitetura ou qualquer área não relacionada ao pedido, NÃO a inclua.
5. Retorne até 10 empresas relevantes. Se houver menos de 10 com correspondência real, retorne apenas as que realmente correspondem. Se não houver nenhuma, retorne lista vazia.
6. Ordene da mais relevante para a menos relevante.

Formato de resposta (JSON válido, sem texto extra):
{
  "resultados": [
    { "id": "uuid-exato-da-lista", "justificativa": "Frase baseada na atividade real da empresa (máx. 120 chars)" }
  ]
}

Lista de empresas (formato: ID | Nome | Atividade):
${contextoEmpresas}`;

    // Chama o GPT-4o-mini
    const resposta = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um sistema de matchmaking preciso. Retorne apenas JSON válido. Nunca inclua empresas que não sejam genuinamente relevantes. Nunca invente serviços que a empresa não declarou em suas atividades.",
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
          empresa_id: empresaId,
          email: solicitante.email,
          tipo_evento: "ia_busca_empresas",
          detalhes: `Busca: "${descricao.trim().slice(0, 200)}" | Resultados: ${resultadosEnriquecidos.length}`,
        }),
        // Histórico de buscas com resultados completos
        supabaseAdmin.from("historico_buscas_ia").insert({
          empresa_id: empresaId,
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
