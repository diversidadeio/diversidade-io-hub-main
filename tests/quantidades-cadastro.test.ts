import { describe, expect, it } from "vitest";
import { lerQuantidadeSalva, quantidadeParaTexto } from "../client/src/lib/quantidadesCadastro";

describe("Quantidades do cadastro", () => {
  it.each([0, 1, 12])("preserva %i ao salvar e recarregar", (quantidade) => {
    expect(lerQuantidadeSalva(quantidadeParaTexto(quantidade))).toBe(quantidade);
  });

  it("distingue zero de um campo ainda não preenchido", () => {
    expect(quantidadeParaTexto(0)).toBe("0");
    expect(lerQuantidadeSalva(0)).toBe(0);
    for (const valor of ["", null, undefined, false, true, "inválido", -1]) {
      expect(lerQuantidadeSalva(valor)).toBe("");
    }
  });
});
