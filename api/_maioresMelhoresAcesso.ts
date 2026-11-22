/**
 * _maioresMelhoresAcesso.ts
 *
 * Recuperação de acesso à inscrição do Maiores & Melhores: a pessoa informa o CNPJ já inscrito
 * e recebe por e-mail um link de uso único (30 minutos) que abre uma nova sessão.
 *
 * Arquivos de `api/` que começam com `_` não viram Serverless Function na Vercel, então este
 * módulo não consome uma das 12 vagas do plano Hobby. Quem atende a rota é a função
 * `enviar-email-aprovacao` (`?action=mm-acesso`, ver vercel.json) e, em desenvolvimento, o
 * roteador `server/api.ts`.
 *
 * A resposta diz o que aconteceu (link enviado, CNPJ sem inscrição ou limite atingido), para quem
 * ainda não se inscreveu ir direto ao cadastro em vez de esperar um e-mail que não vai chegar. Saber
 * se um CNPJ está inscrito não é segredo: a consulta de CNPJ do formulário já mostra isso.
 *
 * Regras de segurança:
 *  - O link só vai para os e-mails da inscrição; a resposta nunca traz o link nem os endereços.
 *  - O endereço do link vem de configuração (SITE_URL), nunca do cabeçalho Origin/Host em produção:
 *    se viesse da requisição, alguém poderia pedir um link para o CNPJ de outra empresa e fazer o
 *    e-mail apontar para um site falso.
 *  - O token vai no fragmento (#) da URL, que não é enviado ao servidor nem a outros sites.
 *  - O limite de pedidos (1 por minuto e 5 por hora por participante) é aplicado no banco.
 */
import { createClient } from "@supabase/supabase-js";
import { enviarEmailMm, provedorEmail } from "./_emailMm.js";

const SITE_PADRAO = "https://www.diversidade.io";

export interface AcessoMm {
  token: string;
  razao_social: string;
  nome: string;
  emails: string[];
}

export interface DependenciasAcessoMm {
  /** Cria o link no banco. null = sem inscrição (ou CNPJ inválido); {limitado} = excedeu o limite. */
  solicitar: (cnpj: string) => Promise<AcessoMm | { limitado: true } | null>;
  enviar: (mensagem: { para: string[]; assunto: string; html: string; texto: string; link: string }) => Promise<void>;
  urlBase: string;
}

export const normalizarCnpjAcesso = (bruto: unknown) => String(bruto ?? "").replace(/[./\s-]/g, "").toUpperCase();
export const cnpjAcessoComFormatoValido = (cnpj: string) => /^[A-Z0-9]{12}\d{2}$/.test(cnpj);

export function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Endereço do site para montar o link. Em produção só vem de configuração. */
export function urlBaseDoSite(req?: any): string {
  const configurada = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configurada) return configurada;
  if (process.env.NODE_ENV !== "production") {
    const host = String(req?.headers?.host ?? "");
    if (/^(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(host)) return `http://${host}`;
  }
  return SITE_PADRAO;
}

export function montarEmailAcesso(acesso: Pick<AcessoMm, "nome" | "razao_social">, link: string) {
  const nome = escaparHtml(acesso.nome);
  const empresa = escaparHtml(acesso.razao_social);
  const assunto = "Seu acesso à inscrição | Maiores & Melhores";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #5c2686; font-size: 26px; margin: 0;">Maiores &amp; Melhores</h1>
        <p style="color: #6b7280; margin: 4px 0 0;">no Empreendedorismo Negro</p>
      </div>
      <div style="background: #f9f5ff; border-radius: 12px; padding: 32px; border: 1px solid #e9d5ff;">
        <h2 style="color: #1f2937; margin-top: 0;">Acesse sua inscrição</h2>
        <p style="color: #374151; line-height: 1.6;">Olá, <strong>${nome}</strong>!</p>
        <p style="color: #374151; line-height: 1.6;">
          Recebemos um pedido de acesso à inscrição de <strong>${empresa}</strong>.
          Use o botão abaixo para voltar a registrar negócios e acompanhar os que você já lançou.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${link}" style="background: #5c2686; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Acessar minha inscrição
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          O link vale por <strong>30 minutos</strong> e só pode ser usado uma vez.
          Se você não fez esse pedido, ignore este e-mail: sem o link, ninguém consegue entrar na sua inscrição.
        </p>
        <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Se o botão não abrir, copie este endereço no navegador:<br>${link}</p>
      </div>
    </div>`;
  const texto = [
    `Olá, ${acesso.nome}!`,
    "",
    `Recebemos um pedido de acesso à inscrição de ${acesso.razao_social} no Maiores & Melhores.`,
    "Abra o link abaixo para voltar a registrar negócios e acompanhar os que você já lançou:",
    "",
    link,
    "",
    "O link vale por 30 minutos e só pode ser usado uma vez.",
    "Se você não fez esse pedido, ignore este e-mail.",
  ].join("\n");
  return { assunto, html, texto };
}

/**
 * enviado: link enviado aos e-mails da inscrição · nao_inscrita: nenhuma inscrição deste CNPJ na edição ativa ·
 * limitado: já houve pedido há menos de 1 minuto (ou 5 na última hora) e o link anterior continua valendo.
 */
export type ResultadoAcessoMm = "enviado" | "nao_inscrita" | "limitado";

/** Pede o link ao banco e, havendo inscrição e limite disponível, envia o e-mail. */
export async function processarSolicitacaoAcesso(cnpj: string, deps: DependenciasAcessoMm): Promise<ResultadoAcessoMm> {
  const resultado = await deps.solicitar(cnpj);
  if (!resultado) return "nao_inscrita";
  if (!("token" in resultado)) return "limitado";
  if (!resultado.emails?.length) throw new Error("Inscrição sem e-mail para enviar o link de acesso.");
  const link = `${deps.urlBase}/maiores-e-melhores/acesso#${resultado.token}`;
  const { assunto, html, texto } = montarEmailAcesso(resultado, link);
  await deps.enviar({ para: resultado.emails, assunto, html, texto, link });
  return "enviado";
}

/** Cliente do banco (service_role) e envio de e-mail (Resend ou SMTP), lidos do ambiente. null = configuração incompleta. */
export function dependenciasPadrao(req?: any): DependenciasAcessoMm | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !chave) return null;

  const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    urlBase: urlBaseDoSite(req),
    async solicitar(cnpj) {
      const { data, error } = await supabase.rpc("mm_acesso_solicitar", { p_cnpj: cnpj });
      if (error) throw error;
      return data as AcessoMm | { limitado: true } | null;
    },
    async enviar({ para, assunto, html, texto, link }) {
      if (!provedorEmail() && process.env.NODE_ENV !== "production") {
        // Desenvolvimento sem e-mail configurado: o link aparece no terminal.
        console.log(`[dev] Link de acesso: ${link}`);
        return;
      }
      // Em produção, sem provedor configurado, enviarEmailMm lança erro e a pessoa é avisada.
      await enviarEmailMm({ para, assunto, html, texto });
    },
  };
}

/** Handler HTTP (Vercel e Express): POST { cnpj } → { ok: true, resultado } ou erro. */
export async function tratarSolicitacaoAcessoMm(req: any, res: any, deps?: DependenciasAcessoMm | null) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  let corpo = req.body;
  if (typeof corpo === "string") {
    try {
      corpo = JSON.parse(corpo);
    } catch {
      corpo = {};
    }
  }
  const cnpj = normalizarCnpjAcesso(corpo?.cnpj);
  if (!cnpjAcessoComFormatoValido(cnpj)) {
    return res.status(400).json({ erro: "Informe o CNPJ da empresa com 14 caracteres." });
  }

  const dependencias = deps ?? dependenciasPadrao(req);
  if (!dependencias) {
    console.error("Maiores & Melhores: SUPABASE_SERVICE_ROLE_KEY ausente, não é possível enviar links de acesso.");
    return res.status(500).json({ erro: "Não foi possível enviar o link agora. Tente novamente mais tarde." });
  }

  try {
    const resultado = await processarSolicitacaoAcesso(cnpj, dependencias);
    return res.json({ ok: true, resultado });
  } catch (erro) {
    // Falhou o banco ou o envio: avisa, para a pessoa não ficar esperando um e-mail que não saiu.
    console.error("Maiores & Melhores: falha ao enviar o link de acesso:", erro);
    return res.status(500).json({ erro: "Não foi possível enviar o link agora. Tente novamente em instantes." });
  }
}
