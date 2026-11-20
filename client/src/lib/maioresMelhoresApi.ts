/**
 * maioresMelhoresApi.ts
 *
 * Chamadas da página pública /maiores-e-melhores. Tudo passa pelas RPCs
 * SECURITY DEFINER da migration 34; o participante é identificado por um token
 * guardado no navegador (o banco guarda apenas o SHA-256 dele).
 */
import { supabase } from "@/lib/supabase";
import type { MmEmpresa, MmEvento, MmNegocio, RespostaComprador } from "@/lib/maioresMelhores";

const CHAVE_TOKEN = "mm_participante_token";
export const BUCKET_FOTOS = "maiores-melhores";

/**
 * Links temporários das fotos (bucket privado) para a administração. Assina em lotes de 100 e
 * ignora os arquivos que não existem mais: quem chama decide o que mostrar sem o link.
 */
export async function assinarFotos(caminhos: string[], segundos: number): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const unicos = [...new Set(caminhos)];
  for (let i = 0; i < unicos.length; i += 100) {
    const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(unicos.slice(i, i + 100), segundos);
    for (const item of data ?? []) if (item.path && item.signedUrl) links.set(item.path, item.signedUrl);
  }
  return links;
}

export function lerTokenParticipante(): string | null {
  try {
    const token = localStorage.getItem(CHAVE_TOKEN);
    return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function salvarTokenParticipante(token: string) {
  try {
    localStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    // Navegação privada ou armazenamento bloqueado: a sessão dura só esta aba.
  }
}

export function limparTokenParticipante() {
  try {
    localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    // ignorado
  }
}

/** Sessão do participante expirou ou é inválida (ERRCODE 28000 nas RPCs). */
export class ErroSessaoMm extends Error {}

async function rpc<T>(funcao: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) {
    if (error.code === "28000") {
      limparTokenParticipante();
      throw new ErroSessaoMm(error.message);
    }
    throw new Error(error.message || "Não foi possível concluir a operação. Tente novamente.");
  }
  return data as T;
}

export interface SessaoMm {
  participante: { nome: string; email: string; telefone: string };
  empresas: MmEmpresa[];
  negocios: MmNegocio[];
}

export interface NotaParaConfirmar {
  compradora: string;
  vendedora: string;
  cnpj_comprador: string;
  cnpj_vendedor: string;
  numero_nota: string;
  serie_nota: string;
  data_emissao: string;
  valor_centavos: number;
  /** Papel da empresa inscrita na nota (migration 39). */
  papel_inscrita?: "comprador" | "vendedor";
  /** Validade do link (migration 39). */
  expira_em?: string;
  /** Empresa inscrita que pede a confirmação (migration 39). Ausente antes da migration. */
  empresa?: {
    razao_social: string;
    cnpj: string;
    municipio: string;
    uf: string;
    responsavel: string;
    email: string;
    telefone: string;
  };
}

export interface NegocioRegistrado {
  id: string;
  /** false = o negócio foi registrado, mas o e-mail não saiu: o participante pode pedir o reenvio. */
  email_enviado: boolean;
}

/**
 * Registro e renovação passam pelo servidor para que ele envie o e-mail ao comprador. O banco continua
 * conferindo token, inscrição, período e regras (mesmas RPCs de antes).
 */
async function negocioNoServidor(pedido: Record<string, unknown>): Promise<NegocioRegistrado> {
  const resposta = await fetch("/api/maiores-melhores-negocio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as Partial<NegocioRegistrado> & { erro?: string };
  if (resposta.status === 401) {
    limparTokenParticipante();
    throw new ErroSessaoMm(corpo.erro || "Sua sessão expirou. Entre novamente.");
  }
  if (!resposta.ok || !corpo.id) throw new Error(corpo.erro || "Não foi possível registrar agora. Tente novamente.");
  return { id: corpo.id, email_enviado: corpo.email_enviado === true };
}

export const mmApi = {
  eventoAtual: () => rpc<MmEvento | null>("mm_evento_atual"),

  entrar: (nome: string, email: string, telefone: string) =>
    rpc<{ token: string; nome: string; email: string }>("mm_entrar", { p_nome: nome, p_email: email, p_telefone: telefone }),

  sessao: (token: string) => rpc<SessaoMm>("mm_sessao", { p_token: token }),

  inscreverEmpresa: (token: string, dados: Record<string, unknown>) =>
    rpc<{ id: string }>("mm_inscrever_empresa", { p_token: token, p_dados: dados }),

  /** Registra a nota e envia o e-mail de confirmação ao comprador (feito pelo servidor). */
  registrarNegocio: (token: string, dados: Record<string, unknown>) => negocioNoServidor({ token, acao: "registrar", dados }),

  /** Gera novo link de confirmação (o anterior deixa de valer) e reenvia o e-mail ao comprador. */
  renovarLink: (token: string, negocioId: string) => negocioNoServidor({ token, acao: "renovar", negocio_id: negocioId }),

  confirmacaoObter: (token: string) => rpc<NotaParaConfirmar>("mm_confirmacao_obter", { p_token: token }),

  confirmacaoResponder: (token: string, resposta: RespostaComprador, observacao: string) =>
    rpc<{ ok: boolean }>("mm_confirmacao_responder", { p_token: token, p_resposta: resposta, p_observacao: observacao }),

  /**
   * Pede o link de acesso por e-mail. A resposta é sempre a mesma, exista ou não inscrição para o CNPJ:
   * o servidor não revela quais CNPJs estão inscritos.
   */
  async solicitarAcesso(cnpj: string): Promise<void> {
    const resposta = await fetch("/api/maiores-melhores-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj }),
    });
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      throw new Error(corpo.erro || "Não foi possível enviar o link agora. Tente novamente em instantes.");
    }
  },

  /**
   * Link temporário (2 minutos) da foto de um sócio da PRÓPRIA inscrição. As fotos ficam num bucket
   * privado: o servidor confere o token do participante e só devolve o link, nunca o caminho do arquivo.
   */
  async urlFotoSocio(token: string, empresaId: string, indice: number): Promise<string> {
    const resposta = await fetch("/api/maiores-melhores-foto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, empresa_id: empresaId, indice }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { url?: string; erro?: string };
    if (!resposta.ok || !corpo.url) throw new Error(corpo.erro || "Não foi possível carregar a foto.");
    return corpo.url;
  },

  /**
   * Salva a edição da própria inscrição. Passa pelo servidor para apagar do armazenamento as fotos que
   * foram trocadas ou removidas.
   */
  async atualizarInscricao(token: string, dados: Record<string, unknown>): Promise<void> {
    const resposta = await fetch("/api/maiores-melhores-inscricao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, dados }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
    if (resposta.status === 401) {
      limparTokenParticipante();
      throw new ErroSessaoMm(corpo.erro || "Sua sessão expirou. Entre novamente.");
    }
    if (!resposta.ok) throw new Error(corpo.erro || "Não foi possível salvar as alterações. Tente novamente.");
  },

  /** Consome o link do e-mail e devolve a nova sessão deste navegador. */
  acessoConfirmar: (token: string) => rpc<{ token: string; empresa_id: string | null }>("mm_acesso_confirmar", { p_token: token }),

  /** Envia a foto opcional para o bucket privado e devolve o caminho a ser gravado na inscrição. */
  async enviarFoto(arquivo: File): Promise<string> {
    const extensao = arquivo.type === "image/png" ? "png" : "jpg";
    const caminho = `fotos/${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, arquivo, {
      contentType: arquivo.type,
      upsert: false,
    });
    if (error) throw new Error("Não foi possível enviar a foto. Remova a foto ou tente novamente.");
    return caminho;
  },
};
