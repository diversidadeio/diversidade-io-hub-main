/**
 * _maioresMelhoresFoto.ts
 *
 * Mostra ao participante a foto de um dos sócios da PRÓPRIA inscrição. As fotos ficam num bucket
 * privado: o servidor confere o token do participante no banco (mm_foto_do_participante), gera um
 * link temporário de 2 minutos e devolve só esse link. O caminho do arquivo nunca vai ao navegador.
 *
 * Como o `_maioresMelhoresAcesso`, este módulo não conta como Serverless Function (prefixo `_`).
 * Quem atende a rota é `enviar-email-aprovacao` (`?action=mm-foto`, ver vercel.json) e, em
 * desenvolvimento, o roteador `server/api.ts`.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "maiores-melhores";
const VALIDADE_SEGUNDOS = 120;

export interface DependenciasFotoMm {
  /** Caminho da foto do sócio, ou null. Erro com `code === "28000"` = sessão inválida. */
  caminhoDaFoto: (token: string, empresaId: string, indice: number) => Promise<string | null>;
  /** Link temporário para o arquivo, ou null se não foi possível gerar. */
  assinar: (caminho: string) => Promise<string | null>;
}

const TOKEN = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function dependenciasFotoPadrao(): DependenciasFotoMm | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !chave) return null;
  const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async caminhoDaFoto(token, empresaId, indice) {
      const { data, error } = await supabase.rpc("mm_foto_do_participante", { p_token: token, p_empresa_id: empresaId, p_indice: indice });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    async assinar(caminho) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, VALIDADE_SEGUNDOS);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  };
}

/** Handler HTTP (Vercel e Express): POST { token, empresa_id, indice } → { url } */
export async function tratarFotoMm(req: any, res: any, deps?: DependenciasFotoMm | null) {
  res.setHeader?.("Cache-Control", "private, no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  let corpo = req.body;
  if (typeof corpo === "string") {
    try {
      corpo = JSON.parse(corpo);
    } catch {
      corpo = {};
    }
  }
  const token = String(corpo?.token ?? "");
  const empresaId = String(corpo?.empresa_id ?? "");
  const indice = corpo?.indice;
  if (!TOKEN.test(token) || !UUID.test(empresaId) || !Number.isInteger(indice) || indice < 0 || indice >= 100) {
    return res.status(400).json({ erro: "Pedido inválido." });
  }

  const dependencias = deps ?? dependenciasFotoPadrao();
  if (!dependencias) {
    console.error("Maiores & Melhores: SUPABASE_SERVICE_ROLE_KEY ausente, não é possível mostrar fotos.");
    return res.status(500).json({ erro: "Não foi possível carregar a foto agora." });
  }

  try {
    const caminho = await dependencias.caminhoDaFoto(token, empresaId, indice);
    if (!caminho) return res.status(404).json({ erro: "Foto não encontrada." });
    const url = await dependencias.assinar(caminho);
    if (!url) return res.status(404).json({ erro: "Foto não encontrada." });
    return res.json({ url });
  } catch (erro: any) {
    if (erro?.code === "28000") return res.status(401).json({ erro: "Sua sessão expirou. Entre novamente." });
    console.error("Maiores & Melhores: falha ao gerar o link da foto:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar a foto agora." });
  }
}
