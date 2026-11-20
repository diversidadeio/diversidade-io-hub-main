/**
 * _maioresMelhoresNegocio.ts
 *
 * Registro de negócio (nota fiscal) do Maiores & Melhores com envio automático do e-mail de
 * confirmação ao comprador.
 *
 * Fluxo: o participante preenche a nota → o servidor registra no banco (RPC mm_registrar_negocio,
 * que confere token, inscrição, período e regras) → monta o e-mail com os dados da nota e o link
 * individual de confirmação → envia ao e-mail do comprador. O comprador abre o link, confere a
 * nota e responde (página /maiores-e-melhores/confirmar).
 *
 * Também atende "Gerar novo link": renova o link (o anterior deixa de valer) e reenvia o e-mail.
 *
 * Regras de segurança:
 *  - O endereço do link vem de configuração (SITE_URL), nunca de Origin/Host em produção, para que
 *    ninguém faça o e-mail apontar para um site falso.
 *  - O token do link vai no fragmento (#) da URL, que não é enviado ao servidor nem a outros sites.
 *  - O link de confirmação vai SÓ para o e-mail do comprador. Nunca volta ao navegador do participante:
 *    se voltasse, o próprio participante poderia abrir o link e confirmar a nota no lugar do comprador.
 *  - Se o e-mail falhar, o negócio continua registrado: a resposta traz `email_enviado: false` e o
 *    participante pode pedir o reenvio (que gera um novo link e tenta enviar de novo).
 *
 * Como os demais `_maioresMelhores*`, não conta como Serverless Function (prefixo `_`). Quem atende
 * a rota é `enviar-email-aprovacao` (`?action=mm-negocio`, ver vercel.json) e, em desenvolvimento,
 * o roteador `server/api.ts`.
 */
import { createClient } from "@supabase/supabase-js";
import { enviarEmailMm, provedorEmail } from "./_emailMm.js";
import { escaparHtml, urlBaseDoSite } from "./_maioresMelhoresAcesso.js";

const TOKEN = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAMANHO_MAXIMO = 20_000;
const WHATSAPP_SUPORTE = { texto: "+55 (11) 98983-2953", link: "https://wa.me/5511989832953" };

/** Dados do negócio usados no e-mail. */
export interface NegocioParaEmail {
  /** Razão social da empresa inscrita na premiação (quem registrou a nota). */
  empresa: string;
  cnpjEmpresa: string;
  municipio: string;
  uf: string;
  /** Responsável pela empresa na inscrição. */
  responsavel: string;
  /** E-mail de contato da empresa inscrita. */
  emailEmpresa: string;
  /** Nome e telefone de quem fez a inscrição (contato para o comprador tirar dúvidas). */
  participante: string;
  telefone: string;
  /** Razão social da empresa parceira, a que vai responder. */
  parceira: string;
  /** Papel da empresa inscrita na nota. */
  papelDaInscrita: "comprador" | "vendedor";
  cnpjComprador: string;
  cnpjVendedor: string;
  numeroNota: string;
  serieNota: string;
  dataEmissao: string;
  valorCentavos: number;
  emailComprador: string;
}

export interface DependenciasNegocioMm {
  /** Registra o negócio no banco. Erro com `code === "28000"` = sessão inválida; `P0001` = regra de negócio. */
  registrar: (token: string, dados: Record<string, unknown>) => Promise<{ id: string; token: string }>;
  /** Gera novo link para um negócio pendente. */
  renovar: (token: string, negocioId: string) => Promise<{ id: string; token: string }>;
  /** Dados do negócio para montar o e-mail. */
  detalhes: (negocioId: string) => Promise<NegocioParaEmail>;
  enviar: (mensagem: { para: string; assunto: string; html: string; texto: string; link: string }) => Promise<void>;
  urlBase: string;
}

/** CNPJ (14 caracteres) → 00.000.000/0000-00. Outro formato volta como veio. */
export function formatarCnpjEmail(bruto: string) {
  const s = String(bruto ?? "").replace(/[./\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{12}\d{2}$/.test(s) ? s.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5") : String(bruto ?? "");
}

/** Só dígitos com DDD → (11) 98983-2953. Outro formato volta como veio. */
export function formatarTelefoneEmail(bruto: string) {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return String(bruto ?? "");
}

export const formatarMoedaEmail = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

/** "2026-03-09" ou ISO completo → "09/03/2026" */
export const formatarDataEmail = (valor: string) => (valor ? valor.slice(0, 10).split("-").reverse().join("/") : "");

/** Ponto final da frase, sem repetir o ponto de nomes como "Varejo S.A." */
const pontoFinal = (nome: string) => (nome.trim().endsWith(".") ? "" : ".");

/** E-mail enviado ao comprador com os dados da nota e o link para confirmar. */
export function montarEmailConfirmacao(negocio: NegocioParaEmail, link: string) {
  const inscritaComprou = negocio.papelDaInscrita === "comprador";
  const nota = negocio.numeroNota + (negocio.serieNota ? ` · Série ${negocio.serieNota}` : "");
  const compradora = inscritaComprou ? negocio.empresa : negocio.parceira;
  const vendedora = inscritaComprou ? negocio.parceira : negocio.empresa;
  const valor = formatarMoedaEmail(negocio.valorCentavos);
  const emissao = formatarDataEmail(negocio.dataEmissao);
  const cnpjComprador = formatarCnpjEmail(negocio.cnpjComprador);
  const cnpjVendedor = formatarCnpjEmail(negocio.cnpjVendedor);
  const telefone = formatarTelefoneEmail(negocio.telefone);
  const local = [negocio.municipio, negocio.uf].filter(Boolean).join("/");

  const assunto = `Confirme a nota fiscal ${negocio.numeroNota} | Maiores & Melhores`;

  const e = {
    empresa: escaparHtml(negocio.empresa),
    parceira: escaparHtml(negocio.parceira),
    cnpjEmpresa: escaparHtml(formatarCnpjEmail(negocio.cnpjEmpresa)),
    local: escaparHtml([negocio.municipio, negocio.uf].filter(Boolean).join("/")),
    responsavel: escaparHtml(negocio.responsavel),
    emailEmpresa: escaparHtml(negocio.emailEmpresa),
    telefone: escaparHtml(telefone),
    compradora: escaparHtml(compradora),
    vendedora: escaparHtml(vendedora),
    cnpjComprador: escaparHtml(cnpjComprador),
    cnpjVendedor: escaparHtml(cnpjVendedor),
    nota: escaparHtml(nota),
    emissao: escaparHtml(emissao),
    valor: escaparHtml(valor),
    link: escaparHtml(link),
  };

  const linha = (rotulo: string, conteudo: string, ultima = false) => `
              <tr>
                <td style="padding: 9px 0; ${ultima ? "" : "border-bottom: 1px solid #efe6f7;"} color: #6b7280; font-size: 14px; width: 38%; vertical-align: top;">${rotulo}</td>
                <td style="padding: 9px 0; ${ultima ? "" : "border-bottom: 1px solid #efe6f7;"} color: #1f2937; font-size: 15px; vertical-align: top;">${conteudo}</td>
              </tr>`;
  const cartao = (titulo: string, linhas: string) => `
        <p style="color: #5c2686; font-size: 13px; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase; margin: 24px 0 8px;">${titulo}</p>
        <table role="presentation" style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; border: 1px solid #e9d5ff;">
          <tr><td style="padding: 4px 20px;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">${linhas}
            </table>
          </td></tr>
        </table>`;
  const detalhe = (texto: string) => `<br><span style="color: #6b7280; font-size: 13px;">${texto}</span>`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #5c2686; font-size: 26px; margin: 0;">Maiores &amp; Melhores</h1>
        <p style="color: #6b7280; margin: 4px 0 0;">no Empreendedorismo Negro</p>
      </div>

      <div style="background: #f9f5ff; border-radius: 12px; padding: 32px; border: 1px solid #e9d5ff;">
        <h2 style="color: #1f2937; margin-top: 0;">Confirme a negociação para a premiação dos Maiores &amp; Melhores</h2>
        <p style="color: #374151; line-height: 1.6;">Olá!</p>
        <p style="color: #374151; line-height: 1.6;">
          A empresa <strong>${e.empresa}</strong> está inscrita na premiação
          <strong>Maiores &amp; Melhores no Empreendedorismo Negro</strong> e informou um negócio realizado
          com a <strong>${e.parceira}</strong>${pontoFinal(negocio.parceira)} Como o seu e-mail foi indicado como contato da empresa parceira,
          pedimos que você confira os dados abaixo e nos diga se estão corretos.
        </p>
${cartao(
    "Empresa que solicita a confirmação",
    linha("Razão social", `<strong>${e.empresa}</strong>`) +
      linha("CNPJ", e.cnpjEmpresa) +
      (local ? linha("Cidade", e.local) : "") +
      linha("Responsável", e.responsavel) +
      linha("E-mail", `<a href="mailto:${e.emailEmpresa}" style="color: #5c2686;">${e.emailEmpresa}</a>`) +
      linha("Telefone", e.telefone, true),
  )}
${cartao(
    "Dados da nota fiscal",
    linha("Empresa compradora", `<strong>${e.compradora}</strong>${detalhe(e.cnpjComprador)}`) +
      linha("Empresa vendedora", `<strong>${e.vendedora}</strong>${detalhe(e.cnpjVendedor)}`) +
      linha("Nota fiscal", e.nota) +
      linha("Data de emissão", e.emissao) +
      linha("Valor total", `<strong>${e.valor}</strong>`, true),
  )}

        <div style="text-align: center; margin: 28px 0;">
          <a href="${e.link}" style="background: #5c2686; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Conferir e responder
          </a>
        </div>

        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 6px;">Na página você poderá escolher uma das respostas:</p>
        <ul style="color: #374151; font-size: 14px; line-height: 1.7; margin-top: 0; padding-left: 20px;">
          <li><strong>Confirmo os dados</strong>: a nota está correta;</li>
          <li><strong>Há divergência nos dados</strong>: algo não confere (você descreve o que);</li>
          <li><strong>Não reconheço a operação</strong>: sua empresa não fez esse negócio.</li>
        </ul>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          O link é individual, vale por <strong>7 dias</strong> e só pode ser usado uma vez.
          Não precisa de cadastro nem de senha. Por favor, não encaminhe este e-mail a terceiros.
        </p>
        <p style="color: #9ca3af; font-size: 12px; word-break: break-all;">Se o botão não abrir, copie este endereço no navegador:<br>${e.link}</p>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center; margin-top: 20px;">
        Não esperava esta mensagem? Você pode ignorá-la, sem nenhuma consequência para a sua empresa, ou responder
        “Não reconheço a operação” pelo link. Dúvidas? Fale conosco pelo WhatsApp
        <a href="${WHATSAPP_SUPORTE.link}" style="color: #5c2686;">${WHATSAPP_SUPORTE.texto}</a>.
      </p>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">Diversidade.io — Maiores &amp; Melhores no Empreendedorismo Negro</p>
    </div>`;

  const texto = [
    "Olá!",
    "",
    `A empresa ${negocio.empresa} está inscrita na premiação Maiores & Melhores no Empreendedorismo Negro e informou um negócio realizado com a ${negocio.parceira}${pontoFinal(negocio.parceira)}`,
    "Como o seu e-mail foi indicado como contato da empresa parceira, pedimos que você confira os dados abaixo e nos diga se estão corretos.",
    "",
    "EMPRESA QUE SOLICITA A CONFIRMAÇÃO",
    `Razão social: ${negocio.empresa}`,
    `CNPJ: ${formatarCnpjEmail(negocio.cnpjEmpresa)}`,
    ...(local ? [`Cidade: ${local}`] : []),
    `Responsável: ${negocio.responsavel}`,
    `E-mail: ${negocio.emailEmpresa}`,
    `Telefone: ${telefone}`,
    "",
    "DADOS DA NOTA FISCAL",
    `Empresa compradora: ${compradora} (CNPJ ${cnpjComprador})`,
    `Empresa vendedora: ${vendedora} (CNPJ ${cnpjVendedor})`,
    `Nota fiscal: ${nota}`,
    `Data de emissão: ${emissao}`,
    `Valor total: ${valor}`,
    "",
    "Para conferir e responder, abra o link abaixo:",
    link,
    "",
    "Você poderá responder: Confirmo os dados, Há divergência nos dados ou Não reconheço a operação.",
    "O link é individual, vale por 7 dias e só pode ser usado uma vez. Não precisa de cadastro nem de senha.",
    "",
    `Não esperava esta mensagem? Pode ignorá-la. Dúvidas: WhatsApp ${WHATSAPP_SUPORTE.texto}.`,
  ].join("\n");

  return { assunto, html, texto };
}

/** Cliente do banco (service_role) e envio de e-mail (Resend ou SMTP), lidos do ambiente. null = configuração incompleta. */
export function dependenciasNegocioPadrao(req?: any): DependenciasNegocioMm | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !chave) return null;

  const supabase = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    urlBase: urlBaseDoSite(req),
    async registrar(token, dados) {
      const { data, error } = await supabase.rpc("mm_registrar_negocio", { p_token: token, p_dados: dados });
      if (error) throw error;
      return data as { id: string; token: string };
    },
    async renovar(token, negocioId) {
      const { data, error } = await supabase.rpc("mm_renovar_link", { p_token: token, p_negocio_id: negocioId });
      if (error) throw error;
      return data as { id: string; token: string };
    },
    async detalhes(negocioId) {
      const { data, error } = await supabase
        .from("mm_negocios")
        .select(
          "cnpj_comprador, cnpj_vendedor, razao_social_parceiro, numero_nota, serie_nota, data_emissao, valor_centavos, email_comprador, " +
            "empresa:mm_empresas!inner(razao_social, cnpj, municipio, uf, responsavel, email, participante:mm_participantes!inner(nome, telefone))",
        )
        .eq("id", negocioId)
        .single();
      if (error) throw error;
      const n = data as any;
      return {
        empresa: n.empresa.razao_social,
        cnpjEmpresa: n.empresa.cnpj,
        municipio: n.empresa.municipio ?? "",
        uf: n.empresa.uf ?? "",
        responsavel: n.empresa.responsavel,
        emailEmpresa: n.empresa.email,
        participante: n.empresa.participante.nome,
        telefone: n.empresa.participante.telefone ?? "",
        parceira: n.razao_social_parceiro,
        papelDaInscrita: n.empresa.cnpj === n.cnpj_comprador ? "comprador" : "vendedor",
        cnpjComprador: n.cnpj_comprador,
        cnpjVendedor: n.cnpj_vendedor,
        numeroNota: n.numero_nota,
        serieNota: n.serie_nota ?? "",
        dataEmissao: n.data_emissao,
        valorCentavos: Number(n.valor_centavos),
        emailComprador: n.email_comprador,
      };
    },
    async enviar({ para, assunto, html, texto, link }) {
      if (!provedorEmail() && process.env.NODE_ENV !== "production") console.log(`[dev] Link de confirmação: ${link}`);
      await enviarEmailMm({ para, assunto, html, texto });
    },
  };
}

/** Monta e envia o e-mail de um negócio. Devolve false (sem lançar) se não foi possível enviar. */
export async function enviarConfirmacaoAoComprador(negocioId: string, tokenConfirmacao: string, deps: DependenciasNegocioMm) {
  try {
    const negocio = await deps.detalhes(negocioId);
    const link = `${deps.urlBase}/maiores-e-melhores/confirmar#${tokenConfirmacao}`;
    const { assunto, html, texto } = montarEmailConfirmacao(negocio, link);
    await deps.enviar({ para: negocio.emailComprador, assunto, html, texto, link });
    return true;
  } catch (erro) {
    // O negócio já está registrado; o participante ainda pode copiar o link e enviar por conta própria.
    console.error("Maiores & Melhores: falha ao enviar o e-mail de confirmação:", erro);
    return false;
  }
}

/**
 * Handler HTTP (Vercel e Express).
 *   POST { token, acao: "registrar", dados } → { id, email_enviado }
 *   POST { token, acao: "renovar", negocio_id } → { id, email_enviado }
 * O token de confirmação fica só no e-mail do comprador (não vai na resposta).
 */
export async function tratarNegocioMm(req: any, res: any, deps?: DependenciasNegocioMm | null) {
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
  const acao = corpo?.acao;
  const dados = corpo?.dados;
  const negocioId = String(corpo?.negocio_id ?? "");
  const dadosValidos = dados && typeof dados === "object" && !Array.isArray(dados) && JSON.stringify(dados).length <= TAMANHO_MAXIMO;
  const pedidoValido =
    TOKEN.test(token) && ((acao === "registrar" && dadosValidos) || (acao === "renovar" && UUID.test(negocioId)));
  if (!pedidoValido) return res.status(400).json({ erro: "Pedido inválido." });

  const dependencias = deps ?? dependenciasNegocioPadrao(req);
  if (!dependencias) {
    console.error("Maiores & Melhores: SUPABASE_SERVICE_ROLE_KEY ausente, não é possível registrar o negócio.");
    return res.status(500).json({ erro: "Não foi possível registrar agora. Tente novamente mais tarde." });
  }

  try {
    const resultado =
      acao === "registrar" ? await dependencias.registrar(token, dados) : await dependencias.renovar(token, negocioId);
    const emailEnviado = await enviarConfirmacaoAoComprador(resultado.id, resultado.token, dependencias);
    return res.json({ id: resultado.id, email_enviado: emailEnviado });
  } catch (erro: any) {
    if (erro?.code === "28000") return res.status(401).json({ erro: "Sua sessão expirou. Entre novamente." });
    // P0001 = regra de negócio do banco (RAISE EXCEPTION), com mensagem própria para a pessoa.
    if (erro?.code === "P0001" && typeof erro.message === "string") return res.status(400).json({ erro: erro.message });
    console.error("Maiores & Melhores: falha ao registrar o negócio:", erro);
    return res.status(500).json({ erro: "Não foi possível registrar agora. Tente novamente em instantes." });
  }
}
