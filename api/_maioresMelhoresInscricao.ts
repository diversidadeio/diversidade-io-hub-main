/**
 * _maioresMelhoresInscricao.ts
 *
 * Edição da inscrição do Maiores & Melhores pelo próprio participante.
 *
 * Passa pelo servidor (e não direto pelo navegador) por um motivo: quando uma foto é trocada ou
 * removida, o arquivo antigo precisa sair do bucket privado de verdade. Só o servidor, com a
 * service_role, pode apagar arquivos de lá. O banco (mm_atualizar_empresa) confere o token, a
 * posse da inscrição, o período aberto e as regras; devolve a lista de arquivos que deixaram de ser
 * usados e este módulo os apaga.
 *
 * Como os demais `_maioresMelhores*`, não conta como Serverless Function (prefixo `_`). Quem atende
 * a rota é `enviar-email-aprovacao` (`?action=mm-inscricao`, ver vercel.json) e, em desenvolvimento,
 * o roteador `server/api.ts`.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "maiores-melhores";
const TOKEN = /^[0-9a-f]{64}$/;
/** Só caminhos no formato que o próprio sistema gera podem ser apagados. */
const CAMINHO_DE_FOTO = /^fotos\/[0-9a-f-]{36}\.(jpg|png)$/;
const TAMANHO_MAXIMO = 60_000;

export interface DependenciasInscricaoMm {
  /** Grava a edição no banco. Devolve os arquivos que saíram da inscrição. */
  atualizar: (token: string, dados: Record<string, unknown>) => Promise<{ fotos_removidas?: string[] } | null>;
  removerFotos: (caminhos: string[]) => Promise<void>;
}

export function dependenciasInscricaoPadrao(): DependenciasInscricaoMm | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !chave) return null;
  const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async atualizar(token, dados) {
      const { data, error } = await supabase.rpc("mm_atualizar_empresa", { p_token: token, p_dados: dados });
      if (error) throw error;
      return data as { fotos_removidas?: string[] } | null;
    },
    async removerFotos(caminhos) {
      const { error } = await supabase.storage.from(BUCKET).remove(caminhos);
      if (error) throw error;
    },
  };
}

/** Handler HTTP (Vercel e Express): POST { token, dados } → { ok: true } */
export async function tratarInscricaoMm(req: any, res: any, deps?: DependenciasInscricaoMm | null) {
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
  const dados = corpo?.dados;
  const dadosValidos = dados && typeof dados === "object" && !Array.isArray(dados);
  if (!TOKEN.test(token) || !dadosValidos || JSON.stringify(dados).length > TAMANHO_MAXIMO) {
    return res.status(400).json({ erro: "Pedido inválido." });
  }

  const dependencias = deps ?? dependenciasInscricaoPadrao();
  if (!dependencias) {
    console.error("Maiores & Melhores: SUPABASE_SERVICE_ROLE_KEY ausente, não é possível salvar a edição.");
    return res.status(500).json({ erro: "Não foi possível salvar agora. Tente novamente mais tarde." });
  }

  try {
    const resultado = await dependencias.atualizar(token, dados);
    const removidas = (resultado?.fotos_removidas ?? []).filter((c) => CAMINHO_DE_FOTO.test(c));
    if (removidas.length) {
      try {
        await dependencias.removerFotos(removidas);
      } catch (erro) {
        // A edição já foi gravada; o arquivo que sobrar fica registrado para limpeza manual.
        console.error("Maiores & Melhores: não foi possível apagar fotos antigas:", removidas, erro);
      }
    }
    return res.json({ ok: true });
  } catch (erro: any) {
    if (erro?.code === "28000") return res.status(401).json({ erro: "Sua sessão expirou. Entre novamente." });
    // P0001 = regra de negócio do banco (RAISE EXCEPTION), com mensagem própria para a pessoa.
    if (erro?.code === "P0001" && typeof erro.message === "string") return res.status(400).json({ erro: erro.message });
    console.error("Maiores & Melhores: falha ao salvar a edição:", erro);
    return res.status(500).json({ erro: "Não foi possível salvar agora. Tente novamente em instantes." });
  }
}
