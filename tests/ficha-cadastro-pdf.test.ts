import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
vi.mock("@/assets/logo.png?inline", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: "data:image/png;base64," + readFileSync(new URL("../client/src/assets/logo.png", import.meta.url)).toString("base64") };
});
import { montarFichaCadastroPdf } from "../client/src/lib/fichaCadastroPdf";

describe("Ficha de cadastro PDF", () => {
  it("gera cadastros incompletos sem perder valores falsos ou zero", () => {
    const doc = montarFichaCadastroPdf({ e_socio: false, tem_conta_pj: true }, [{ participacao_percentual: 0 }], []);
    const pdf = doc.output();
    expect(pdf).toContain("diversidade.io");
    expect(pdf).toContain("/Subtype /Image");
    expect(pdf).toContain("(N\u00e3o) Tj");
    expect(pdf).toContain("(Sim) Tj");
    expect(pdf).toContain("(0) Tj");
    expect(pdf).not.toContain("undefined");
    expect(pdf).not.toContain("NaN");
  });

  it("pagina textos extensos, todos os sócios e grupos de impacto e inclui links para anexos", () => {
    const doc = montarFichaCadastroPdf({
      id: "cadastro-exemplo", razao_social: "Empresa Exemplo de Inclusão LTDA", status_aprovacao: "pendente",
      nome_responsavel: "Maria Souza", email: "maria@example.com", cnpj: "12.345.678/0001-90",
      sobre_empresa: "Atuamos com capacitação e serviços para empreendedores diversos. ".repeat(85),
      cartao_cnpj_url: "https://example.com/cartao.pdf", formas_pagamento: ["PIX", "Boleto"],
    }, Array.from({ length: 8 }, (_, i) => ({
      nome: `Sócio de exemplo ${i + 1}`, cpf: "123.456.789-00", cep: "01001-000",
      data_nascimento: "1990-01-01", participacao_percentual: 0, participacao_valor: 1500,
    })), ["GESTOR_DIRETO", "COLABORADOR_DIRETO", "GESTOR", "SOCIO", "COLABORADOR"].map(tipo => ({
      tipo, cep: "01001-000", endereco_validado: "Praça da Sé, São Paulo - SP",
    })));
    expect(doc.getNumberOfPages()).toBeGreaterThan(4);
    const pdf = doc.output();
    expect(pdf).toContain("https://example.com/cartao.pdf");
    expect(pdf).toContain("01/01/1990");
    expect(pdf).toContain("PIX, Boleto");
    expect(pdf).toContain("exemplo 8");
    if (process.env.FICHA_PDF_SAIDA) writeFileSync(process.env.FICHA_PDF_SAIDA, Buffer.from(doc.output("arraybuffer")));
  });
});
