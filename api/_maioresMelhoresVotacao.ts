import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACAO = "mm-voto";

interface Requisicao {
  method?: string;
  query?: Record<string, unknown>;
  body?: unknown;
}

interface Resposta {
  setHeader(nome: string, valor: string): unknown;
  status(codigo: number): Resposta;
  json(dados: unknown): unknown;
}

export async function tratarVotacaoMm(req: Requisicao, res: Resposta) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return res.status(503).json({ erro: "Votação indisponível." });
  const banco = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    if (req.method === "GET") {
      const evento = req.query?.evento;
      if (typeof evento !== "string" || !UUID.test(evento)) {
        return res.status(400).json({ erro: "Edição inválida." });
      }
      const configuracao = await banco.from("mm_votacoes").select("estado,inicio,fim,mm_eventos!inner(ativo)")
        .eq("evento_id", evento).eq("mm_eventos.ativo", true).maybeSingle();
      if (configuracao.error) throw configuracao.error;
      const votacao = configuracao.data;
      if (!votacao || votacao.estado === "rascunho") return res.json(null);

      const categorias = await banco.from("mm_voto_categorias").select("id,nome")
        .eq("evento_id", evento).eq("ativa", true).order("nome");
      if (categorias.error) throw categorias.error;
      const ranking = [];
      for (let offset = 0; ; offset += 500) {
        const pagina = await banco.from("mm_voto_ranking").select("*").eq("evento_id", evento)
          .order("id").range(offset, offset + 499);
        if (pagina.error) throw pagina.error;
        ranking.push(...pagina.data);
        if (pagina.data.length < 500) break;
      }
      const agora = Date.now();
      return res.json({
        inicio: votacao.inicio,
        fim: votacao.fim,
        estado: votacao.estado,
        aberta: votacao.estado === "ativa" && agora >= Date.parse(votacao.inicio) && agora < Date.parse(votacao.fim),
        categorias: categorias.data,
        ranking,
      });
    }

    const { evento, concorrente, email, token } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof evento !== "string" || !UUID.test(evento)
      || typeof concorrente !== "string" || !UUID.test(concorrente)
      || typeof email !== "string" || email.length > 254 || !EMAIL.test(email.trim())
      || typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return res.status(400).json({ erro: "Confira o concorrente, o e-mail e a verificação." });
    }

    const secret = process.env.MM_TURNSTILE_SECRET_KEY;
    if (!secret) return res.status(503).json({ erro: "Verificação de segurança indisponível." });
    const verificacao = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!verificacao.ok) return res.status(503).json({ erro: "Verificação de segurança indisponível." });
    const desafio = await verificacao.json() as { success?: boolean; action?: string; hostname?: string };
    const hosts = (process.env.MM_TURNSTILE_HOSTS || "diversidade.io,www.diversidade.io").split(",").map((host) => host.trim());
    if (!desafio.success || desafio.action !== ACAO || !hosts.includes(desafio.hostname ?? "")) {
      return res.status(422).json({ erro: "Refaça a verificação de segurança e tente novamente." });
    }

    const resultado = await banco.rpc("mm_registrar_voto", {
      p_evento: evento,
      p_concorrente: concorrente,
      p_email: email.trim().toLowerCase(),
      p_comprovante: createHash("sha256").update(token).digest("hex"),
    });
    if (resultado.error) throw resultado.error;
    if (!resultado.data) return res.status(409).json({ erro: "Este concorrente ou a votação está indisponível." });
    return res.status(201).json({ sucesso: true });
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code;
    console.error("Falha na votação Maiores & Melhores", codigo ?? "serviço indisponível");
    return res.status(503).json({ erro: "Não foi possível concluir a operação. Tente novamente." });
  }
}
