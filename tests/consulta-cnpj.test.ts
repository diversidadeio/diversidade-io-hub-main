import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarCnpj, validarDigitosCnpj } from "../client/src/lib/consultaCnpj";

const cnpj = "45428188000101";
const resposta = (status: number, dados = {}) => new Response(JSON.stringify(dados), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Consulta CNPJ do cadastro gratuito", () => {
  it("valida os dígitos antes de consultar e bloqueia números inválidos", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(validarDigitosCnpj(cnpj)).toBe(true);
    expect(validarDigitosCnpj("00000000000000")).toBe(false);
    await expect(consultarCnpj("45428188000102")).rejects.toMatchObject({ motivo: "INVALIDO" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa somente a fonte principal quando ela retorna a empresa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(200, { cnpj, razao_social: "Empresa" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await consultarCnpj(cnpj)).toMatchObject({ cnpj, razao_social: "Empresa" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recupera a empresa e normaliza CNAEs e sócios quando BrasilAPI retorna 500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resposta(500)).mockResolvedValueOnce(resposta(200, {
      taxId: cnpj, alias: "Empresa MG", company: { name: "MG LTDA", members: [{ person: { name: "Maria" } }] },
      mainActivity: { id: 8599604, text: "Treinamento" }, sideActivities: [{ id: 7319002, text: "Promoção de vendas" }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await consultarCnpj(cnpj)).toEqual({
      cnpj, razao_social: "MG LTDA", nome_fantasia: "Empresa MG", cnae_fiscal: 8599604,
      cnae_fiscal_descricao: "Treinamento", cnaes_secundarios: [{ codigo: 7319002, descricao: "Promoção de vendas" }],
      qsa: [{ nome_socio: "Maria" }],
    });
    expect(fetchMock.mock.calls[1][0]).toContain("open.cnpja.com/office/");
  });

  it("reporta não encontrado somente se ambas as fontes retornarem 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(404)));
    await expect(consultarCnpj(cnpj)).rejects.toMatchObject({ motivo: "NAO_ENCONTRADO" });
  });

  it("interrompe a consulta travada e tenta a fonte alternativa", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("timeout")));
      }))
      .mockResolvedValueOnce(resposta(200, { taxId: cnpj, company: { name: "MG LTDA" } }));
    vi.stubGlobal("fetch", fetchMock);
    const consulta = consultarCnpj(cnpj);
    await vi.advanceTimersByTimeAsync(10000);
    expect(await consulta).toMatchObject({ cnpj, razao_social: "MG LTDA" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("distingue indisponibilidade técnica de empresa não encontrada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resposta(404)).mockRejectedValueOnce(new TypeError("rede")));
    await expect(consultarCnpj(cnpj)).rejects.toMatchObject({ motivo: "INDISPONIVEL" });
  });

  it("não aceita respostas vazias ou dados de outro CNPJ como validação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(resposta(200, {})).mockResolvedValueOnce(resposta(200, {
      taxId: "00000000000000", company: { name: "Outra empresa" },
    })));
    await expect(consultarCnpj(cnpj)).rejects.toMatchObject({ motivo: "INDISPONIVEL" });
  });
});
