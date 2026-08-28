import { createClient } from "@supabase/supabase-js";

/**
 * /api/ler-logs-empresa
 *
 * Endpoint que retorna logs filtrados por empresa de duas formas:
 *  - modo "sobre_empresa": ações de ADM que tiveram a empresa como alvo
 *    (filtra por empresa_id ou nome_empresa)
 *  - modo "usuarios_empresa": ações dos usuários vinculados à empresa
 *    (resolve emails via empresa_usuarios e filtra logs por email IN (...))
 *
 * Corpo da requisição (POST):
 *   empresaId?   : number   — ID numérico da empresa
 *   nomeEmpresa? : string   — Nome parcial para busca (ilike)
 *   modo         : "sobre_empresa" | "usuarios_empresa"
 *   page?        : number   (padrão 1)
 *   pageSize?    : number   (padrão 20)
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

let supabaseAdmin: any;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  if (!supabaseAdmin) {
    console.error(
      "ler-logs-empresa: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente."
    );
    return res.status(500).json({ erro: "Configuração do Supabase ausente" });
  }

  try {
    const {
      empresaId,
      nomeEmpresa,
      modo = "sobre_empresa",
      page = 1,
      pageSize = 20,
    } = req.body;

    // ── Modo 1: Ações de ADM sobre a empresa ────────────────────────────────
    if (modo === "sobre_empresa") {
      let q = supabaseAdmin
        .from("logs_acesso")
        .select("*", { count: "exact" })
        .like("tipo_evento", "adm_%");

      if (empresaId) {
        q = q.eq("empresa_id", empresaId);
      } else if (nomeEmpresa && nomeEmpresa.trim().length > 1) {
        q = q.ilike("nome_empresa", `%${nomeEmpresa.trim()}%`);
      } else {
        return res
          .status(400)
          .json({ erro: "Informe empresaId ou nomeEmpresa" });
      }

      const de = (page - 1) * pageSize;
      const ate = de + pageSize - 1;

      const { data, error, count } = await q
        .order("criado_em", { ascending: false })
        .range(de, ate);

      if (error) throw error;

      return res.json({ logs: data || [], total: count || 0 });
    }

    // ── Modo 2: Ações dos usuários vinculados à empresa ──────────────────────
    if (modo === "usuarios_empresa") {
      // 2a. Resolver o empresaId pelo nome, se não foi informado diretamente
      let idResolvido: number | null = empresaId ?? null;

      if (!idResolvido && nomeEmpresa && nomeEmpresa.trim().length > 1) {
        const { data: empresasEncontradas } = await supabaseAdmin
          .from("empresas")
          .select("id")
          .ilike("razao_social", `%${nomeEmpresa.trim()}%`)
          .limit(5);

        if (!empresasEncontradas || empresasEncontradas.length === 0) {
          // Tenta por nome_fantasia também
          const { data: porFantasia } = await supabaseAdmin
            .from("empresas")
            .select("id")
            .ilike("nome_fantasia", `%${nomeEmpresa.trim()}%`)
            .limit(5);

          if (!porFantasia || porFantasia.length === 0) {
            return res.json({ logs: [], total: 0, empresasEncontradas: 0 });
          }
          idResolvido = porFantasia[0].id;
        } else {
          idResolvido = empresasEncontradas[0].id;
        }
      }

      if (!idResolvido) {
        return res
          .status(400)
          .json({ erro: "Informe empresaId ou nomeEmpresa" });
      }

      // 2b. Buscar todos os e-mails vinculados à empresa
      //     (tabela empresa_usuarios + email principal da empresa)
      const emailsSet = new Set<string>();

      // Email principal da empresa
      const { data: empresaData } = await supabaseAdmin
        .from("empresas")
        .select("email")
        .eq("id", idResolvido)
        .single();

      if (empresaData?.email) {
        emailsSet.add(empresaData.email.toLowerCase());
      }

      // Usuários convidados via empresa_usuarios
      const { data: usuariosVinculados } = await supabaseAdmin
        .from("empresa_usuarios")
        .select("email")
        .eq("empresa_id", idResolvido);

      if (usuariosVinculados) {
        usuariosVinculados.forEach((u: any) => {
          if (u.email) emailsSet.add(u.email.toLowerCase());
        });
      }

      const emails = Array.from(emailsSet);

      if (emails.length === 0) {
        return res.json({ logs: [], total: 0, emails: [] });
      }

      // 2c. Buscar logs onde email IN (emails da empresa)
      //     Exclui eventos adm_* pois esses são ações do admin, não dos usuários da empresa
      const de = (page - 1) * pageSize;
      const ate = de + pageSize - 1;

      const { data, error, count } = await supabaseAdmin
        .from("logs_acesso")
        .select("*", { count: "exact" })
        .in("email", emails)
        .not("tipo_evento", "like", "adm_%")
        .order("criado_em", { ascending: false })
        .range(de, ate);

      if (error) throw error;

      return res.json({
        logs: data || [],
        total: count || 0,
        emailsVinculados: emails,
      });
    }

    return res.status(400).json({ erro: `Modo desconhecido: ${modo}` });
  } catch (err: any) {
    console.error("Erro no endpoint /ler-logs-empresa:", err);
    return res.status(500).json({ erro: err.message });
  }
}
