import { describe, expect, it } from "vitest";
import { filtrarIdade, filtrarPercentual, formatarParticipacaoMonetaria } from "../client/src/lib/camposNumericosSocio";

describe("Campos numéricos dos sócios", () => {
  it("formata reais em centavos com separadores brasileiros", () => {
    expect(formatarParticipacaoMonetaria("3000000")).toBe("30.000,00");
    expect(formatarParticipacaoMonetaria("R$ 30.000,00")).toBe("30.000,00");
    expect(formatarParticipacaoMonetaria("1")).toBe("0,01");
    expect(formatarParticipacaoMonetaria("0")).toBe("0,00");
    expect(formatarParticipacaoMonetaria("")).toBe("");
    expect(formatarParticipacaoMonetaria("99999999999999999999")).toBe("999.999.999.999.999.999,99");
  });

  it("rejeita letras digitadas ou coladas sem alterar o valor", () => {
    expect(formatarParticipacaoMonetaria("30.000,00a", "30.000,00")).toBe("30.000,00");
    expect(filtrarPercentual("100abc", "100")).toBe("100");
    expect(filtrarIdade("30 anos", "30")).toBe("30");
  });

  it("permite percentual decimal e idade inteira, inclusive limpar os campos", () => {
    expect(filtrarPercentual("12.5")).toBe("12,5");
    expect(filtrarPercentual("12,50")).toBe("12,50");
    expect(filtrarPercentual("12,345", "12,34")).toBe("12,34");
    expect(filtrarIdade("100")).toBe("100");
    expect(filtrarIdade("1e2", "1")).toBe("1");
    expect(filtrarIdade("30.5", "30")).toBe("30");
    expect(filtrarIdade("")).toBe("");
    expect(filtrarPercentual("")).toBe("");
  });
});
