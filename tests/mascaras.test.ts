import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aplicarMascara,
  mascaraCnpj,
  mascaraDigitos,
  mascaraMoeda,
  mascaraSerieNota,
  mascaraTelefone,
} from "../client/src/lib/mascaras";
import { cnpjValido, converterValorEmCentavos } from "../client/src/lib/maioresMelhores";

describe("máscara de telefone", () => {
  it("formata celular e fixo enquanto digita", () => {
    expect(mascaraTelefone("")).toBe("");
    expect(mascaraTelefone("1")).toBe("(1");
    expect(mascaraTelefone("16")).toBe("(16");
    expect(mascaraTelefone("169")).toBe("(16) 9");
    expect(mascaraTelefone("1699303")).toBe("(16) 9930-3");
    expect(mascaraTelefone("16993036103")).toBe("(16) 99303-6103");
    expect(mascaraTelefone("1633036103")).toBe("(16) 3303-6103");
  });

  it("não passa de 11 dígitos e ignora letras", () => {
    expect(mascaraTelefone("1699303610399")).toBe("(16) 99303-6103");
    expect(mascaraTelefone("(16) 99a303-6103")).toBe("(16) 99303-6103");
  });

  it("remove o +55 do autopreenchimento e de textos colados", () => {
    expect(mascaraTelefone("+55 16 99303-6103")).toBe("(16) 99303-6103");
    expect(mascaraTelefone("5516993036103")).toBe("(16) 99303-6103");
    expect(mascaraTelefone("+55 (16) 3303-6103")).toBe("(16) 3303-6103");
  });

  it("é idempotente e formata o que veio do banco (só dígitos)", () => {
    expect(mascaraTelefone(mascaraTelefone("16993036103"))).toBe("(16) 99303-6103");
    expect(mascaraTelefone("11988887777")).toBe("(11) 98888-7777");
  });
});

describe("máscara de CNPJ", () => {
  it("formata numérico progressivamente", () => {
    expect(mascaraCnpj("45")).toBe("45");
    expect(mascaraCnpj("454")).toBe("45.4");
    expect(mascaraCnpj("45428188")).toBe("45.428.188");
    expect(mascaraCnpj("454281880001")).toBe("45.428.188/0001");
    expect(mascaraCnpj("45428188000101")).toBe("45.428.188/0001-01");
    expect(mascaraCnpj("4542818800010199")).toBe("45.428.188/0001-01");
  });

  it("aceita CNPJ alfanumérico em maiúsculas e é idempotente", () => {
    expect(mascaraCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(mascaraCnpj("12.ABC.345/01DE-35")).toBe("12.ABC.345/01DE-35");
    expect(cnpjValido(mascaraCnpj("12abc34501de35"))).toBe(true);
    expect(cnpjValido(mascaraCnpj("45428188000101"))).toBe(true);
  });
});

describe("máscara de valor em reais", () => {
  it("digita como em caixa eletrônico", () => {
    expect(mascaraMoeda("")).toBe("");
    expect(mascaraMoeda("0")).toBe("");
    expect(mascaraMoeda("5")).toBe("0,05");
    expect(mascaraMoeda("50")).toBe("0,50");
    expect(mascaraMoeda("150")).toBe("1,50");
    expect(mascaraMoeda("150000")).toBe("1.500,00");
    expect(mascaraMoeda("2500000")).toBe("25.000,00");
    expect(mascaraMoeda("123456789012")).toBe("1.234.567.890,12");
  });

  it("reaplicar sobre o valor já formatado mantém o resultado", () => {
    expect(mascaraMoeda("1.500,00")).toBe("1.500,00");
    expect(mascaraMoeda("1.500,001")).toBe("15.000,01");
  });

  it("o valor mascarado converte certo para centavos", () => {
    expect(converterValorEmCentavos(mascaraMoeda("150000"))).toBe(150000);
    expect(converterValorEmCentavos(mascaraMoeda("5"))).toBe(5);
    expect(converterValorEmCentavos(mascaraMoeda("2500000"))).toBe(2500000);
    expect(converterValorEmCentavos(mascaraMoeda("123456789012"))).toBe(123456789012);
  });
});

describe("outras máscaras", () => {
  it("número da nota só aceita algarismos até o limite", () => {
    expect(mascaraDigitos(15)("12a3-4")).toBe("1234");
    expect(mascaraDigitos(15)("1234567890123456789")).toBe("123456789012345");
  });

  it("série da nota vira maiúscula e limita a 12", () => {
    expect(mascaraSerieNota("a1 b-2")).toBe("A1B-2");
    expect(mascaraSerieNota("abcdefghijklmnop")).toBe("ABCDEFGHIJKL");
  });
});

describe("cursor ao aplicar a máscara no campo", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Campo simulado: o navegador já alterou value/selectionStart antes de chamar a máscara. */
  function digitar(valor: string, cursor: number, mascara = mascaraTelefone, tipo = "insertText", anterior?: string) {
    const campo = {
      value: valor,
      selectionStart: cursor,
      dataset: anterior === undefined ? {} : { mascarado: anterior },
      setSelectionRange(inicio: number) {
        this.selectionStart = inicio;
      },
    };
    vi.stubGlobal("document", { activeElement: campo });
    aplicarMascara(campo as unknown as HTMLInputElement, mascara, tipo);
    return { valor: campo.value, cursor: campo.selectionStart };
  }

  it("digitar no fim deixa o cursor depois do último caractere", () => {
    expect(digitar("1", 1)).toEqual({ valor: "(1", cursor: 2 });
    expect(digitar("(16) 9", 6)).toEqual({ valor: "(16) 9", cursor: 6 });
    expect(digitar("(16) 99303-61039", 16)).toEqual({ valor: "(16) 99303-6103", cursor: 15 });
  });

  it("digitar no meio mantém o cursor junto do caractere digitado", () => {
    expect(digitar("(16) 997303-6103", 8)).toEqual({ valor: "(16) 99730-3610", cursor: 8 });
  });

  it("apagar logo depois de um separador remove o dígito anterior em vez de travar", () => {
    // "(16) 9930-3" com o cursor depois do "-": o navegador apagou o "-" e o campo ficou "(16) 99303"
    expect(digitar("(16) 99303", 9, mascaraTelefone, "deleteContentBackward", "(16) 9930-3")).toEqual({
      valor: "(16) 9933",
      cursor: 8,
    });
  });

  it("apagar um dígito comum só reformata", () => {
    expect(digitar("(16) 9930-", 9, mascaraTelefone, "deleteContentBackward", "(16) 99303-6")).toEqual({
      valor: "(16) 9930",
      cursor: 9,
    });
  });

  it("valor em reais: o cursor fica sempre no fim, digitando tecla a tecla", () => {
    let campo = digitar("1", 1, mascaraMoeda);
    expect(campo).toEqual({ valor: "0,01", cursor: 4 });
    // a próxima tecla entra no fim do texto formatado, onde o cursor ficou
    for (const [tecla, esperado] of [["5", "0,15"], ["0", "1,50"], ["0", "15,00"], ["0", "150,00"], ["0", "1.500,00"]] as const) {
      campo = digitar(campo.valor + tecla, campo.valor.length + 1, mascaraMoeda);
      expect(campo).toEqual({ valor: esperado, cursor: esperado.length });
    }
  });

  it("valor em reais: apagar o último dígito mantém o cursor no fim", () => {
    expect(digitar("1.500,0", 7, mascaraMoeda, "deleteContentBackward", "1.500,00")).toEqual({ valor: "150,00", cursor: 6 });
  });

  it("funciona no CNPJ", () => {
    expect(digitar("45.428.1880", 11, mascaraCnpj)).toEqual({ valor: "45.428.188/0", cursor: 12 });
  });
});
