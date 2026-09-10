/**
 * authFetch.ts
 *
 * Monta os cabeçalhos das chamadas às funções serverless em `/api`.
 *
 * As rotas de auditoria e presença rodam com a service_role do Supabase e
 * por isso validam o access token do usuário no servidor (ver `api/_auth.ts`).
 * Sem o header Authorization elas respondem 401.
 */
import { supabase } from "@/lib/supabase";

/** Access token da sessão atual, ou null se não houver sessão. */
export async function obterAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Cabeçalhos com JSON + Authorization quando houver sessão.
 *
 * Não falha quando o usuário está deslogado: as rotas que aceitam chamadas
 * anônimas (ex: registro de `login_falha`) continuam funcionando.
 */
export async function cabecalhosAutenticados(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await obterAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
