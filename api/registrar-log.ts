import { supabaseAdmin, identificar, ipDaRequisicao, userAgentDaRequisicao } from "./_auth";

/**
 * Eventos que legitimamente acontecem sem sessão ativa:
 *  - login_falha: por definição, ninguém está autenticado;
 *  - oportunidade_*: a página de oportunidade é acessada por link público.
 *
 * Qualquer outro tipo exige token válido. Sem isso, qualquer pessoa poderia
 * injetar eventos falsos (ex: "adm_deletar_empresa") na auditoria.
 */
const EVENTOS_ANONIMOS = new Set([
  "login_falha",
  "oportunidade_visualizada",
  "oportunidade_interesse",
  "oportunidade_sem_interesse",
]);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  if (!supabaseAdmin) {
    console.error("Vercel Error: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente nas variáveis de ambiente.");
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  try {
    const {
      email,
      tipo_evento,
      empresa_id,
      nome_empresa,
      executor_adm_email,
      detalhes,
    } = req.body;

    if (!tipo_evento) {
      return res.status(400).json({ erro: "tipo_evento é obrigatório" });
    }

    const identidade = await identificar(req);

    if (!identidade && !EVENTOS_ANONIMOS.has(tipo_evento)) {
      return res.status(401).json({ erro: "Não autenticado" });
    }

    // Com sessão válida, o autor do evento é sempre a identidade do token —
    // nunca o e-mail enviado no corpo, que o cliente poderia forjar.
    // Todos os call sites já registram quem executou a ação (o alvo vai em
    // `detalhes`/`nome_empresa`), então isso não altera o significado dos logs.
    const emailAutor = identidade
      ? identidade.email
      : (email || "desconhecido");

    const ip_address = ipDaRequisicao(req);
    const user_agent = userAgentDaRequisicao(req);

    const empresaIdParam = empresa_id || null;

    const { error } = await supabaseAdmin.rpc("registrar_log_acesso", {
      p_email: emailAutor,
      p_tipo_evento: tipo_evento,
      p_empresa_id: empresaIdParam,
      p_nome_empresa: nome_empresa || null,
      p_executor_adm_email: executor_adm_email || null,
      p_ip_address: ip_address,
      p_user_agent: user_agent,
      p_detalhes: detalhes || null,
    });

    if (error) {
      console.error("Erro ao registrar log de auditoria:", error.message);
      return res.status(500).json({ erro: "Falha ao registrar log" });
    }

    return res.json({ sucesso: true });
  } catch (err: any) {
    console.error("Erro crítico em /registrar-log:", err);
    return res.status(500).json({ erro: "Falha no servidor" });
  }
}
