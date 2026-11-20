import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DependenciasNegocioMm,
  type NegocioParaEmail,
  formatarCnpjEmail,
  formatarTelefoneEmail,
  montarEmailConfirmacao,
  tratarNegocioMm,
} from "../api/_maioresMelhoresNegocio";

const SESSAO = "ab".repeat(32);
const CONFIRMACAO = "cd".repeat(32);
const NEGOCIO_ID = "11111111-2222-3333-4444-555555555555";

const negocio: NegocioParaEmail = {
  empresa: "Afro Tech Soluções Ltda",
  cnpjEmpresa: "41596417000146",
  municipio: "São Paulo",
  uf: "SP",
  responsavel: "Ana Souza",
  emailEmpresa: "contato@afrotech.com.br",
  participante: "Ana Souza",
  telefone: "11989832953",
  parceira: "Grande Varejo S.A.",
  papelDaInscrita: "vendedor",
  cnpjComprador: "11222333000181",
  cnpjVendedor: "41596417000146",
  numeroNota: "1523",
  serieNota: "1",
  dataEmissao: "2026-11-18",
  valorCentavos: 1500000,
  emailComprador: "compras@grandevarejo.com.br",
};
const link = `https://www.diversidade.io/maiores-e-melhores/confirmar#${CONFIRMACAO}`;

function resposta() {
  const r: any = { statusCode: 200, corpo: undefined };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (c: unknown) => { r.corpo = c; return r; };
  r.setHeader = vi.fn();
  return r as { statusCode: number; corpo: any; status: any; json: any; setHeader: any };
}

function dependencias(sobrescrever: Partial<DependenciasNegocioMm> = {}) {
  const enviar = vi.fn().mockResolvedValue(undefined);
  const deps: DependenciasNegocioMm = {
    registrar: vi.fn().mockResolvedValue({ id: NEGOCIO_ID, token: CONFIRMACAO }),
    renovar: vi.fn().mockResolvedValue({ id: NEGOCIO_ID, token: CONFIRMACAO }),
    detalhes: vi.fn().mockResolvedValue(negocio),
    enviar,
    urlBase: "https://www.diversidade.io",
    ...sobrescrever,
  };
  return { deps, enviar };
}

afterEach(() => vi.restoreAllMocks());

describe("formatos do e-mail", () => {
  it("formata CNPJ e telefone", () => {
    expect(formatarCnpjEmail("41596417000146")).toBe("41.596.417/0001-46");
    expect(formatarCnpjEmail("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
    expect(formatarTelefoneEmail("11989832953")).toBe("(11) 98983-2953");
    expect(formatarTelefoneEmail("1133334444")).toBe("(11) 3333-4444");
    expect(formatarTelefoneEmail("123")).toBe("123");
  });
});

describe("e-mail de confirmação ao comprador", () => {
  it("traz os dados da empresa que pede a confirmação", () => {
    const { html, texto } = montarEmailConfirmacao(negocio, link);
    for (const trecho of ["Afro Tech Soluções Ltda", "41.596.417/0001-46", "São Paulo/SP", "Ana Souza", "contato@afrotech.com.br", "(11) 98983-2953"]) {
      expect(html).toContain(trecho);
      expect(texto).toContain(trecho);
    }
  });

  it("traz os dados da nota, com comprador e vendedor corretos", () => {
    const { html, texto, assunto } = montarEmailConfirmacao(negocio, link);
    expect(assunto).toBe("Confirme a nota fiscal 1523 | Maiores & Melhores");
    expect(texto).toContain("Empresa compradora: Grande Varejo S.A. (CNPJ 11.222.333/0001-81)");
    expect(texto).toContain("Empresa vendedora: Afro Tech Soluções Ltda (CNPJ 41.596.417/0001-46)");
    expect(texto).toContain("Nota fiscal: 1523 · Série 1");
    expect(texto).toContain("Data de emissão: 18/11/2026");
    expect(html).toContain("R$");
    expect(html).toContain("15.000,00");
  });

  it("inverte comprador e vendedor quando a empresa inscrita é a compradora", () => {
    const { texto } = montarEmailConfirmacao(
      { ...negocio, papelDaInscrita: "comprador", cnpjComprador: negocio.cnpjVendedor, cnpjVendedor: negocio.cnpjComprador },
      link,
    );
    expect(texto).toContain("Empresa compradora: Afro Tech Soluções Ltda");
    expect(texto).toContain("Empresa vendedora: Grande Varejo S.A.");
  });

  it("leva o botão com o link, a validade e as três respostas", () => {
    const { html, texto } = montarEmailConfirmacao(negocio, link);
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain("7 dias");
    expect(texto).toContain(link);
    for (const resposta of ["Confirmo os dados", "Há divergência nos dados", "Não reconheço a operação"]) expect(texto).toContain(resposta);
  });

  it("omite a série e a cidade quando não existem", () => {
    const { texto } = montarEmailConfirmacao({ ...negocio, serieNota: "", municipio: "", uf: "" }, link);
    expect(texto).toContain("Nota fiscal: 1523\n");
    expect(texto).not.toContain("Cidade:");
  });

  it("não repete o ponto final de nomes que terminam em ponto", () => {
    const { html, texto } = montarEmailConfirmacao(negocio, link);
    expect(texto).not.toContain("S.A..");
    expect(html).not.toContain("S.A.</strong>.");
    expect(montarEmailConfirmacao({ ...negocio, parceira: "Loja Ltda" }, link).texto).toContain("com a Loja Ltda.");
  });

  it("escapa HTML dos textos digitados pelo participante", () => {
    const { html } = montarEmailConfirmacao(
      { ...negocio, empresa: "<script>x</script>", parceira: '<img src=x onerror=alert(1)>', responsavel: 'A "B" & C' },
      link,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("A &quot;B&quot; &amp; C");
  });
});

describe("registro do negócio com envio do e-mail", () => {
  const dados = { empresa_id: NEGOCIO_ID, numero_nota: "1523" };

  it("registra, envia ao e-mail do comprador e devolve o link", async () => {
    const { deps, enviar } = dependencias();
    const res = resposta();
    await tratarNegocioMm({ method: "POST", body: { token: SESSAO, acao: "registrar", dados } }, res, deps);

    expect(deps.registrar).toHaveBeenCalledWith(SESSAO, dados);
    expect(res.corpo).toEqual({ id: NEGOCIO_ID, email_enviado: true });
    // O link vai só para o e-mail do comprador, nunca de volta ao participante.
    expect(JSON.stringify(res.corpo)).not.toContain(CONFIRMACAO);
    expect(enviar).toHaveBeenCalledTimes(1);
    const mensagem = enviar.mock.calls[0][0];
    expect(mensagem.para).toBe("compras@grandevarejo.com.br");
    expect(mensagem.link).toBe(link);
    expect(mensagem.html).toContain(`href="${link}"`);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("se o e-mail falhar, o negócio continua registrado e a resposta avisa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = dependencias({ enviar: vi.fn().mockRejectedValue(new Error("Resend fora do ar")) });
    const res = resposta();
    await tratarNegocioMm({ method: "POST", body: { token: SESSAO, acao: "registrar", dados } }, res, deps);
    expect(res.statusCode).toBe(200);
    expect(res.corpo).toEqual({ id: NEGOCIO_ID, email_enviado: false });
    expect(JSON.stringify(res.corpo)).not.toContain(CONFIRMACAO);
  });

  it("renovar gera novo link e reenvia o e-mail", async () => {
    const { deps, enviar } = dependencias();
    const res = resposta();
    await tratarNegocioMm({ method: "POST", body: { token: SESSAO, acao: "renovar", negocio_id: NEGOCIO_ID } }, res, deps);
    expect(deps.renovar).toHaveBeenCalledWith(SESSAO, NEGOCIO_ID);
    expect(deps.registrar).not.toHaveBeenCalled();
    expect(res.corpo).toEqual({ id: NEGOCIO_ID, email_enviado: true });
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("não envia e-mail quando o banco recusa (regra de negócio)", async () => {
    const { deps, enviar } = dependencias({
      registrar: vi.fn().mockRejectedValue({ code: "P0001", message: "Confira o CNPJ da empresa compradora." }),
    });
    const res = resposta();
    await tratarNegocioMm({ method: "POST", body: { token: SESSAO, acao: "registrar", dados } }, res, deps);
    expect(res.statusCode).toBe(400);
    expect(res.corpo).toEqual({ erro: "Confira o CNPJ da empresa compradora." });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("sessão expirada devolve 401 e não envia e-mail", async () => {
    const { deps, enviar } = dependencias({ registrar: vi.fn().mockRejectedValue({ code: "28000", message: "x" }) });
    const res = resposta();
    await tratarNegocioMm({ method: "POST", body: { token: SESSAO, acao: "registrar", dados } }, res, deps);
    expect(res.statusCode).toBe(401);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("erro inesperado não vaza detalhes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = dependencias({ registrar: vi.fn().mockRejectedValue(new Error("connection refused 10.0.0.5")) });
    const res = resposta();
    await tratarNegocioMm({ method: "POST", body: { token: SESSAO, acao: "registrar", dados } }, res, deps);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.corpo)).not.toContain("10.0.0.5");
  });

  it("recusa método, token, ação e dados inválidos", async () => {
    const { deps } = dependencias();
    const chamar = async (req: any) => {
      const res = resposta();
      await tratarNegocioMm(req, res, deps);
      return res.statusCode;
    };
    expect(await chamar({ method: "GET" })).toBe(405);
    expect(await chamar({ method: "POST", body: { token: "curto", acao: "registrar", dados } })).toBe(400);
    expect(await chamar({ method: "POST", body: { token: SESSAO, acao: "apagar", dados } })).toBe(400);
    expect(await chamar({ method: "POST", body: { token: SESSAO, acao: "registrar", dados: [] } })).toBe(400);
    expect(await chamar({ method: "POST", body: { token: SESSAO, acao: "renovar", negocio_id: "1; drop table" } })).toBe(400);
    expect(deps.registrar).not.toHaveBeenCalled();
    expect(deps.renovar).not.toHaveBeenCalled();
  });
});
