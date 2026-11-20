import { describe, expect, it } from "vitest";
import { enviarEmailMm, provedorEmail } from "../api/_emailMm";

describe("serviço de e-mail do Maiores & Melhores", () => {
  it("prefere o Resend, usa SMTP como alternativa e acusa quando não há nenhum", () => {
    expect(provedorEmail({ RESEND_API_KEY: "re_x", SMTP_USER: "a@b.com", SMTP_PASS: "s" })).toBe("resend");
    expect(provedorEmail({ RESEND_API_KEY: " ", SMTP_USER: "a@b.com", SMTP_PASS: "s" })).toBe("smtp");
    expect(provedorEmail({ SMTP_USER: "a@b.com" })).toBeNull();
    expect(provedorEmail({})).toBeNull();
  });

  it("sem serviço configurado, o envio falha (o negócio continua registrado e a tela avisa)", async () => {
    await expect(enviarEmailMm({ para: "x@y.com", assunto: "a", html: "<p>a</p>", texto: "a" }, {})).rejects.toThrow(/Nenhum serviço/);
  });
});
