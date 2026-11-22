import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AcessoMm,
  type DependenciasAcessoMm,
  cnpjAcessoComFormatoValido,
  escaparHtml,
  montarEmailAcesso,
  normalizarCnpjAcesso,
  tratarSolicitacaoAcessoMm,
  urlBaseDoSite,
} from "../api/_maioresMelhoresAcesso";

const TOKEN = "ab".repeat(32);
const acesso: AcessoMm = { token: TOKEN, razao_social: "Afro Ltda", nome: "Ana Souza", emails: ["ana@x.com", "contato@afro.com"] };

function resposta() {
  const r: any = { statusCode: 200, corpo: undefined };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (c: unknown) => { r.corpo = c; return r; };
  return r as { statusCode: number; corpo: any; status: any; json: any };
}

function dependencias(solicitar: DependenciasAcessoMm["solicitar"], urlBase = "https://www.diversidade.io") {
  const enviar = vi.fn().mockResolvedValue(undefined);
  return { deps: { solicitar, enviar, urlBase } satisfies DependenciasAcessoMm, enviar };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("CNPJ do pedido de acesso", () => {
  it("normaliza máscara e caixa e confere o formato", () => {
    expect(normalizarCnpjAcesso(" 45.428.188/0001-01 ")).toBe("45428188000101");
    expect(normalizarCnpjAcesso("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(normalizarCnpjAcesso(undefined)).toBe("");
    expect(cnpjAcessoComFormatoValido("45428188000101")).toBe(true);
    expect(cnpjAcessoComFormatoValido("12ABC34501DE35")).toBe(true);
    expect(cnpjAcessoComFormatoValido("123")).toBe(false);
    expect(cnpjAcessoComFormatoValido("1234567890123A")).toBe(false);
  });
});

describe("e-mail com o link de acesso", () => {
  const link = `https://www.diversidade.io/maiores-e-melhores/acesso#${TOKEN}`;

  it("leva o link, a validade e o nome da empresa", () => {
    const { assunto, html, texto } = montarEmailAcesso(acesso, link);
    expect(assunto).toContain("Maiores & Melhores");
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain("30 minutos");
    expect(html).toContain("Afro Ltda");
    expect(texto).toContain(link);
    expect(texto).toContain("Ana Souza");
  });

  it("escapa HTML de nome e razão social (texto digitado pelo participante)", () => {
    const { html } = montarEmailAcesso({ nome: '<img src=x onerror=alert(1)>', razao_social: 'A & B "Ltda" <script>' }, link);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("A &amp; B &quot;Ltda&quot; &lt;script&gt;");
    expect(escaparHtml("<'&\">")).toBe("&lt;&#39;&amp;&quot;&gt;");
  });
});

describe("endereço do link", () => {
  it("usa SITE_URL quando configurada, sem barra no fim", () => {
    vi.stubEnv("SITE_URL", "https://diversidade.example/");
    expect(urlBaseDoSite({ headers: { host: "evil.com" } })).toBe("https://diversidade.example");
  });

  it("em produção ignora o cabeçalho Host", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(urlBaseDoSite({ headers: { host: "localhost:5173" } })).toBe("https://www.diversidade.io");
    expect(urlBaseDoSite({ headers: { host: "evil.com" } })).toBe("https://www.diversidade.io");
  });

  it("em desenvolvimento aceita só localhost", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(urlBaseDoSite({ headers: { host: "localhost:5173" } })).toBe("http://localhost:5173");
    expect(urlBaseDoSite({ headers: { host: "127.0.0.1:5199" } })).toBe("http://127.0.0.1:5199");
    expect(urlBaseDoSite({ headers: { host: "evil.com" } })).toBe("https://www.diversidade.io");
    expect(urlBaseDoSite({ headers: { host: "localhost.evil.com" } })).toBe("https://www.diversidade.io");
    expect(urlBaseDoSite()).toBe("https://www.diversidade.io");
  });
});

describe("POST /api/maiores-melhores-acesso", () => {
  it("só aceita POST", async () => {
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "GET" }, r, dependencias(vi.fn()).deps);
    expect(r.statusCode).toBe(405);
  });

  it("recusa CNPJ com formato inválido sem consultar o banco", async () => {
    const solicitar = vi.fn();
    for (const cnpj of [undefined, "", "123", "45.428.188/0001", "<script>"]) {
      const r = resposta();
      await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj } }, r, dependencias(solicitar).deps);
      expect(r.statusCode).toBe(400);
    }
    expect(solicitar).not.toHaveBeenCalled();
  });

  it("aceita o corpo como texto JSON", async () => {
    const { deps, enviar } = dependencias(vi.fn().mockResolvedValue(acesso));
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: JSON.stringify({ cnpj: "45.428.188/0001-01" }) }, r, deps);
    expect(r.statusCode).toBe(200);
    expect(deps.solicitar).toHaveBeenCalledWith("45428188000101");
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("com inscrição: envia um e-mail para todos os endereços, com o link do site configurado", async () => {
    const { deps, enviar } = dependencias(vi.fn().mockResolvedValue(acesso), "https://www.diversidade.io");
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r, deps);
    expect(r.corpo).toEqual({ ok: true, resultado: "enviado" });
    const msg = enviar.mock.calls[0][0];
    expect(msg.para).toEqual(["ana@x.com", "contato@afro.com"]);
    expect(msg.link).toBe(`https://www.diversidade.io/maiores-e-melhores/acesso#${TOKEN}`);
    expect(msg.html).toContain(msg.link);
  });

  it("sem inscrição: avisa (para a página levar ao cadastro) e não envia e-mail", async () => {
    const { deps, enviar } = dependencias(vi.fn().mockResolvedValue(null));
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r, deps);
    expect([r.statusCode, r.corpo]).toEqual([200, { ok: true, resultado: "nao_inscrita" }]);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("limite atingido: avisa que o link já foi enviado e não envia outro", async () => {
    const { deps, enviar } = dependencias(vi.fn().mockResolvedValue({ limitado: true }));
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r, deps);
    expect([r.statusCode, r.corpo]).toEqual([200, { ok: true, resultado: "limitado" }]);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("a resposta nunca traz o link nem os e-mails da inscrição", async () => {
    const { deps } = dependencias(vi.fn().mockResolvedValue(acesso));
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r, deps);
    const corpo = JSON.stringify(r.corpo);
    expect(corpo).not.toContain(TOKEN);
    expect(corpo).not.toContain("ana@x.com");
  });

  it("falha do banco ou do envio responde 500, para a pessoa não ficar esperando um e-mail que não saiu", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const banco = dependencias(vi.fn().mockRejectedValue(new Error("banco fora")));
    const r1 = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r1, banco.deps);
    expect(r1.statusCode).toBe(500);
    expect(r1.corpo.erro).toContain("Tente novamente");

    const email = dependencias(vi.fn().mockResolvedValue(acesso));
    email.enviar.mockRejectedValue(new Error("resend fora"));
    const r2 = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r2, email.deps);
    expect(r2.statusCode).toBe(500);

    expect(erro).toHaveBeenCalledTimes(2);
  });

  it("sem service_role configurada responde 500 em vez de fingir que enviou", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = resposta();
    await tratarSolicitacaoAcessoMm({ method: "POST", body: { cnpj: "45428188000101" } }, r);
    expect(r.statusCode).toBe(500);
  });
});
