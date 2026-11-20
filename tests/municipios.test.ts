import { afterEach, describe, expect, it, vi } from "vitest";
import { chaveMunicipio, nomeOficialMunicipio, nomeProprio } from "../client/src/lib/municipios";

const lista = (nomes: string[]) => new Response(JSON.stringify(nomes.map((nome, id) => ({ id, nome }))), { status: 200 });
afterEach(() => vi.unstubAllGlobals());

describe("nome de município", () => {
  it("coloca iniciais maiúsculas e mantém as ligações em minúsculas", () => {
    expect(nomeProprio("SAO PAULO")).toBe("Sao Paulo");
    expect(nomeProprio("RIBEIRAO PRETO")).toBe("Ribeirao Preto");
    expect(nomeProprio("SANTA BARBARA D'OESTE")).toBe("Santa Barbara d'Oeste");
    expect(nomeProprio("PORTO DE PEDRAS")).toBe("Porto de Pedras");
    expect(nomeProprio("  CAMPOS DOS GOYTACAZES ")).toBe("Campos dos Goytacazes");
    expect(nomeProprio("BALNEARIO CAMBORIU")).toBe("Balneario Camboriu");
    expect(nomeProprio("")).toBe("");
  });

  it("compara sem acento, caixa e pontuação", () => {
    expect(chaveMunicipio("Santa Bárbara d'Oeste")).toBe(chaveMunicipio("SANTA BARBARA D OESTE"));
    expect(chaveMunicipio("São Paulo")).toBe("SAO PAULO");
    expect(chaveMunicipio("Brasília")).toBe(chaveMunicipio("BRASILIA"));
  });

  it("troca o nome da BrasilAPI pelo nome oficial do IBGE e consulta a UF uma vez só", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => lista(["São Paulo", "Ribeirão Preto", "Santa Bárbara d'Oeste"]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await nomeOficialMunicipio("SP", "SAO PAULO")).toBe("São Paulo");
    expect(await nomeOficialMunicipio("sp", "RIBEIRAO PRETO")).toBe("Ribeirão Preto");
    expect(await nomeOficialMunicipio("SP", "SANTA BARBARA D OESTE")).toBe("Santa Bárbara d'Oeste");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/estados/SP/municipios");
  });

  it("sem resposta do IBGE usa o nome com iniciais maiúsculas e tenta de novo na próxima", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("rede")));
    expect(await nomeOficialMunicipio("RJ", "NOVA FRIBURGO")).toBe("Nova Friburgo");

    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => lista(["Nova Friburgo"])));
    expect(await nomeOficialMunicipio("RJ", "NOVA FRIBURGO")).toBe("Nova Friburgo");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("município que não está na lista mantém o nome recebido formatado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => lista(["Belo Horizonte"])));
    expect(await nomeOficialMunicipio("MG", "CIDADE NOVA")).toBe("Cidade Nova");
  });
});
