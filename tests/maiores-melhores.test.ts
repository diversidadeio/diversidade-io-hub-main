import { describe, expect, it } from "vitest";
import {
  calcularRankings,
  calcularRankingsPorPerfil,
  cnpjValido,
  converterValorEmCentavos,
  formatarCnpj,
  formatarData,
  hojeSaoPaulo,
  normalizarCnpj,
  papelDaInscrita,
  perfisPermitidos,
  situacaoConfirmacao,
  situacaoPeriodo,
  valorValidadoSemDuplicar,
  type MmEmpresa,
  type MmNegocio,
} from "../client/src/lib/maioresMelhores";

const empresa = (id: string, razao_social: string, categoria: MmEmpresa["categoria"] = "afro"): MmEmpresa => ({
  id,
  evento_id: "ev",
  categoria,
  porte: "Micro",
  razao_social,
  cnpj: "45428188000101",
  responsavel: "R",
  email: "r@x.com",
  municipio: "São Paulo",
  uf: "SP",
  socios: [],
  criado_em: "2026-01-01T00:00:00Z",
});

let seq = 0;
const negocio = (empresa_id: string, cnpj_parceiro: string, valor_centavos: number, extra: Partial<MmNegocio> = {}): MmNegocio => ({
  id: `n${seq++}`,
  evento_id: "ev",
  empresa_id,
  perfil_parceiro: "media",
  cnpj_comprador: cnpj_parceiro,
  cnpj_vendedor: "45428188000101",
  cnpj_parceiro,
  razao_social_parceiro: "Parceira",
  data_emissao: "2026-03-01",
  valor_centavos,
  numero_nota: String(seq),
  serie_nota: "",
  email_comprador: "c@p.com",
  whatsapp_comprador: null,
  token_expira_em: null,
  resposta_comprador: "confirmado",
  observacao_comprador: null,
  respondido_em: null,
  status: "validado",
  motivo: "",
  criado_em: "2026-03-01T00:00:00Z",
  ...extra,
});

describe("Maiores & Melhores — CNPJ", () => {
  it("valida CNPJ numérico com e sem máscara", () => {
    expect(cnpjValido("45428188000101")).toBe(true);
    expect(cnpjValido("45.428.188/0001-01")).toBe(true);
    expect(cnpjValido("45.428.188/0001-02")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });

  it("valida CNPJ alfanumérico (Receita Federal 2026)", () => {
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12abc34501de35")).toBe(true);
    expect(cnpjValido("12.ABC.345/01DE-36")).toBe(false);
  });

  it("normaliza e formata", () => {
    expect(normalizarCnpj(" 12.abc.345/01de-35 ")).toBe("12ABC34501DE35");
    expect(formatarCnpj("45428188000101")).toBe("45.428.188/0001-01");
    expect(formatarCnpj("abc")).toBe("abc");
  });
});

describe("Maiores & Melhores — valores e datas", () => {
  it("converte valores digitados em centavos", () => {
    expect(converterValorEmCentavos("1500,00")).toBe(150000);
    expect(converterValorEmCentavos("25.000,00")).toBe(2500000);
    expect(converterValorEmCentavos("1500.5")).toBe(150050);
    expect(converterValorEmCentavos("R$ 1.234.567,8")).toBe(123456780);
    expect(converterValorEmCentavos("12")).toBe(1200);
    expect(converterValorEmCentavos("1,234")).toBeNaN();
    expect(converterValorEmCentavos("abc")).toBeNaN();
    expect(converterValorEmCentavos("")).toBeNaN();
  });

  it("formata datas e calcula o período da edição", () => {
    expect(formatarData("2026-03-09")).toBe("09/03/2026");
    expect(formatarData("2026-03-09T12:00:00Z")).toBe("09/03/2026");
    const evento = { inicio_cadastro: "2026-03-01", fim_cadastro: "2026-03-31" };
    expect(situacaoPeriodo(evento, "2026-02-28")).toBe("agendado");
    expect(situacaoPeriodo(evento, "2026-03-01")).toBe("aberto");
    expect(situacaoPeriodo(evento, "2026-03-31")).toBe("aberto");
    expect(situacaoPeriodo(evento, "2026-04-01")).toBe("encerrado");
  });

  it("usa o fuso de São Paulo para o dia atual", () => {
    // 02:00 UTC de 10/03 ainda é 09/03 em São Paulo (UTC-3)
    expect(hojeSaoPaulo(new Date("2026-03-10T02:00:00Z"))).toBe("2026-03-09");
  });
});

describe("Maiores & Melhores — regras do negócio", () => {
  it("define o papel da empresa inscrita", () => {
    expect(papelDaInscrita("inclusiva", "afro", "vendedor")).toBe("comprador");
    expect(papelDaInscrita("afro", "grande", "comprador")).toBe("vendedor");
    expect(papelDaInscrita("afro", "afro", "comprador")).toBe("comprador");
    expect(perfisPermitidos("inclusiva")).toEqual(["afro"]);
    expect(perfisPermitidos("afro")).toEqual(["afro", "media", "grande"]);
  });

  it("descreve a situação da confirmação do comprador", () => {
    expect(situacaoConfirmacao({ resposta_comprador: "divergencia", token_expira_em: null })).toBe("Comprador informou divergência");
    expect(situacaoConfirmacao({ resposta_comprador: null, token_expira_em: "2026-01-01T00:00:00Z" }, Date.parse("2026-02-01"))).toBe(
      "Link de confirmação vencido",
    );
    expect(situacaoConfirmacao({ resposta_comprador: null, token_expira_em: "2026-03-01T00:00:00Z" }, Date.parse("2026-02-01"))).toBe(
      "Aguardando confirmação do comprador",
    );
  });
});

describe("Maiores & Melhores — apuração", () => {
  const empresas = [empresa("a", "Alfa"), empresa("b", "Beta"), empresa("c", "Gama"), empresa("i", "Inclusiva SA", "inclusiva")];
  const negocios = [
    negocio("a", "P1", 1000),
    negocio("a", "P1", 2000), // mesmo parceiro conta uma vez
    negocio("a", "P2", 500),
    negocio("b", "P3", 3500),
    negocio("b", "P4", 1),
    negocio("c", "P5", 9999, { status: "pendente" }), // não entra
    negocio("c", "P6", 100, { status: "indeferido" }), // não entra
    negocio("i", "P7", 700),
  ];

  it("conta parceiros distintos, soma valores validados e compartilha posição em empates", () => {
    const rankings = calcularRankings(empresas, negocios);
    const afroParceiros = rankings.find((r) => r.categoria === "afro" && r.metrica === "parceiros")!;
    expect(afroParceiros.linhas.map((l) => [l.razaoSocial, l.pontuacao, l.posicao])).toEqual([
      ["Alfa", 2, 1],
      ["Beta", 2, 1],
    ]);
    const afroValor = rankings.find((r) => r.categoria === "afro" && r.metrica === "valor")!;
    expect(afroValor.linhas.map((l) => [l.razaoSocial, l.pontuacao, l.posicao])).toEqual([
      ["Beta", 3501, 1],
      ["Alfa", 3500, 2],
    ]);
    const inclusiva = rankings.find((r) => r.categoria === "inclusiva" && r.metrica === "valor")!;
    expect(inclusiva.linhas).toHaveLength(1);
    expect(rankings).toHaveLength(4);
  });

  it("separa o ranking dos afroempreendedores pelo perfil da parceira", () => {
    const lista = [
      negocio("a", "N1", 800, { perfil_parceiro: "afro" }),
      negocio("a", "G1", 100, { perfil_parceiro: "grande" }),
      negocio("b", "G2", 900, { perfil_parceiro: "grande" }),
      negocio("b", "G3", 50, { perfil_parceiro: "grande" }),
      negocio("b", "N2", 5, { perfil_parceiro: "afro", status: "pendente" }), // não entra
      negocio("i", "N3", 999, { perfil_parceiro: "afro" }), // inclusiva fica de fora
    ];
    const rankings = calcularRankingsPorPerfil(empresas, lista);
    expect(rankings.map((r) => `${r.perfil}:${r.metrica}`)).toEqual([
      "afro:parceiros", "afro:valor", "media:parceiros", "media:valor", "grande:parceiros", "grande:valor",
    ]);
    expect(rankings.every((r) => r.categoria === "afro")).toBe(true);
    const linhas = (perfil: string, metrica: string) =>
      rankings.find((r) => r.perfil === perfil && r.metrica === metrica)!.linhas.map((l) => [l.razaoSocial, l.pontuacao, l.posicao]);
    expect(linhas("afro", "valor")).toEqual([["Alfa", 800, 1]]);
    expect(linhas("media", "parceiros")).toEqual([]);
    expect(linhas("grande", "parceiros")).toEqual([["Beta", 2, 1], ["Alfa", 1, 2]]);
    expect(linhas("grande", "valor")).toEqual([["Beta", 950, 1], ["Alfa", 100, 2]]);
  });

  it("não duplica a mesma nota registrada pelas duas pontas", () => {
    const nota = { numero_nota: "77", serie_nota: "1", cnpj_vendedor: "V" };
    expect(
      valorValidadoSemDuplicar([
        negocio("a", "X", 5000, nota),
        negocio("i", "Y", 5000, nota),
        negocio("b", "Z", 100),
        negocio("b", "Z", 999, { status: "pendente" }),
      ]),
    ).toBe(5100);
  });
});
