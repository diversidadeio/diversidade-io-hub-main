import { describe, expect, it } from "vitest";
import { situacaoConfirmacao, situacaoDoComprador } from "@/lib/maioresMelhores";

const agora = Date.parse("2026-11-20T12:00:00Z");

describe("situação da resposta do comprador", () => {
  it("usa a resposta dada, mesmo com o link vencido", () => {
    expect(situacaoDoComprador({ resposta_comprador: "confirmado", token_expira_em: "2026-01-01T00:00:00Z" }, agora)).toBe("confirmado");
    expect(situacaoDoComprador({ resposta_comprador: "divergencia", token_expira_em: null }, agora)).toBe("divergencia");
    expect(situacaoDoComprador({ resposta_comprador: "desconhecido", token_expira_em: null }, agora)).toBe("desconhecido");
  });

  it("sem resposta: vencido ou aguardando, conforme a validade do link", () => {
    expect(situacaoDoComprador({ resposta_comprador: null, token_expira_em: "2026-11-19T00:00:00Z" }, agora)).toBe("vencido");
    expect(situacaoDoComprador({ resposta_comprador: null, token_expira_em: "2026-11-27T00:00:00Z" }, agora)).toBe("aguardando");
    expect(situacaoDoComprador({ resposta_comprador: null, token_expira_em: null }, agora)).toBe("aguardando");
  });

  it("mostra 'Aprovado pelo comprador' quando o comprador confirma", () => {
    expect(situacaoConfirmacao({ resposta_comprador: "confirmado", token_expira_em: null }, agora)).toBe("Aprovado pelo comprador");
  });
});
