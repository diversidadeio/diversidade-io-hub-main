/**
 * _emailMm.ts
 *
 * Envio dos e-mails do Maiores & Melhores (link de acesso e confirmação de nota pelo comprador).
 *
 * Usa o Resend quando RESEND_API_KEY está configurada (produção, na Vercel). Sem ela, usa o SMTP
 * configurado em SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS, o mesmo que o restante do sistema usa no
 * desenvolvimento local (server/api.ts). Sem nenhum dos dois, não há como enviar.
 *
 * Prefixo `_`: não conta como Serverless Function na Vercel.
 */
import { Resend } from "resend";

const REMETENTE_RESEND = "Diversidade.io <nao-responder@diversidade.io>";

export interface MensagemMm {
  para: string | string[];
  assunto: string;
  html: string;
  texto: string;
}

export type ProvedorEmail = "resend" | "smtp";

/** Qual serviço vai enviar, conforme o ambiente. null = nenhum configurado. */
export function provedorEmail(env: NodeJS.ProcessEnv = process.env): ProvedorEmail | null {
  if (env.RESEND_API_KEY?.trim()) return "resend";
  if (env.SMTP_USER?.trim() && env.SMTP_PASS) return "smtp";
  return null;
}

/** Envia o e-mail. Lança erro se nenhum serviço estiver configurado ou se o envio falhar. */
export async function enviarEmailMm(mensagem: MensagemMm, env: NodeJS.ProcessEnv = process.env): Promise<ProvedorEmail> {
  const provedor = provedorEmail(env);
  if (!provedor) throw new Error("Nenhum serviço de e-mail configurado (RESEND_API_KEY ou SMTP_USER/SMTP_PASS).");

  if (provedor === "resend") {
    const { error } = await new Resend(env.RESEND_API_KEY!.trim()).emails.send({
      from: REMETENTE_RESEND,
      to: mensagem.para,
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return provedor;
  }

  // Carregado só quando usado: em produção (Resend) o nodemailer nem é importado.
  const { default: nodemailer } = await import("nodemailer");
  const usuario = env.SMTP_USER!.trim();
  const transporte = nodemailer.createTransport({
    host: env.SMTP_HOST?.trim() || "smtp.office365.com",
    port: Number(env.SMTP_PORT) || 587,
    secure: Number(env.SMTP_PORT) === 465,
    requireTLS: Number(env.SMTP_PORT) !== 465,
    auth: { user: usuario, pass: env.SMTP_PASS },
  });
  await transporte.sendMail({
    from: `"Diversidade.io" <${usuario}>`,
    to: mensagem.para,
    subject: mensagem.assunto,
    html: mensagem.html,
    text: mensagem.texto,
  });
  return provedor;
}
