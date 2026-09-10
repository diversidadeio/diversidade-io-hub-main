/**
 * _auth.ts
 *
 * Helper de autenticacao compartilhado pelas funcoes serverless.
 *
 * Arquivos em `api/` que comecam com `_` nao viram Serverless Function na
 * Vercel, entao este modulo nao consome uma das 12 vagas do plano Hobby.
 *
 * O modelo de acesso reaproveita o que o app ja usa no front-end:
 *   1. O cliente envia o access token do Supabase Auth no header Authorization.
 *   2. Validamos o token com `auth.getUser(token)`.
 *   3. Resolvemos o perfil pela RPC `obter_sessao_usuario`, a mesma que o
 *      AuthContext usa para montar a sessao (retorna tipo_usuario e papel).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

/** Cliente com service_role: ignora RLS. Nunca exponha o resultado sem checar identidade antes. */
export const supabaseAdmin: any =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export interface Identidade {
  authUserId: string;
  /** E-mail verificado pelo Supabase Auth. Sempre prefira este ao e-mail vindo do body. */
  email: string;
  empresaId: string | null;
  tipoUsuario: "adm" | "empresa" | null;
  papel: string | null;
  isAdm: boolean;
}

function extrairToken(req: any): string | null {
  const header: string = req.headers?.authorization || req.headers?.Authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Identifica quem esta chamando. Retorna null se nao houver token valido.
 * Nunca lanca: uma falha de rede na validacao equivale a "nao autenticado".
 */
export async function identificar(req: any): Promise<Identidade | null> {
  if (!supabaseAdmin) return null;

  const token = extrairToken(req);
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;

    const user = data.user;
    const { data: perfil } = await supabaseAdmin.rpc("obter_sessao_usuario", {
      p_auth_user_id: user.id,
    });
    const p = Array.isArray(perfil) ? perfil[0] : perfil;

    return {
      authUserId: user.id,
      email: (p?.email || user.email || "").toLowerCase(),
      empresaId: p?.empresa_id ?? null,
      tipoUsuario: (p?.tipo_usuario as "adm" | "empresa") ?? null,
      papel: p?.papel ?? null,
      isAdm: p?.tipo_usuario === "adm",
    };
  } catch {
    return null;
  }
}

/**
 * Exige uma sessao valida. Se nao houver, responde 401 e retorna null —
 * o handler deve apenas dar `return` quando isso acontecer.
 */
export async function exigirSessao(req: any, res: any): Promise<Identidade | null> {
  const id = await identificar(req);
  if (!id) {
    res.status(401).json({ erro: "Nao autenticado" });
    return null;
  }
  return id;
}

/** Exige sessao valida de um administrador (tipo_usuario = 'adm'). Responde 401/403. */
export async function exigirAdm(req: any, res: any): Promise<Identidade | null> {
  const id = await identificar(req);
  if (!id) {
    res.status(401).json({ erro: "Nao autenticado" });
    return null;
  }
  if (!id.isAdm) {
    res.status(403).json({ erro: "Acesso restrito a administradores" });
    return null;
  }
  return id;
}

/** IP real do chamador, respeitando o proxy da Vercel. */
export function ipDaRequisicao(req: any): string | null {
  const fwd = req.headers?.["x-forwarded-for"];
  const bruto = Array.isArray(fwd) ? fwd[0] : fwd;
  return (bruto as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
}

/** User-agent do chamador. */
export function userAgentDaRequisicao(req: any): string | null {
  return (req.headers?.["user-agent"] as string) || null;
}
