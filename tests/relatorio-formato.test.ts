/**
 * Formatadores de exibicao do Relatorio de Auditoria em PDF.
 *
 * Ficam separados de `relatorioEmpresaPdf.ts` para poderem ser testados sem
 * carregar o jsPDF (que espera um DOM) dentro do vitest em Node.
 */
import { describe, expect, it } from "vitest";
import {
  formatarDataBrasilia,
  formatarDataHoraBrasilia,
  formatarNumero,
  rotuloStatusAprovacao,
  rotuloStatusSolicitacao,
} from "../client/src/lib/relatorioFormato";

describe("formatarDataHoraBrasilia", () => {
  /**
   * A Vercel grava em UTC. Um acesso as 23h30 de Brasilia fica como 02h30 do
   * dia seguinte; sem converter, o "ultimo acesso" do relatorio sai um dia
   * adiantado.
   */
  it("converte um instante UTC para o horario de Brasilia", () => {
    expect(formatarDataHoraBrasilia("2026-09-11T02:30:00.000Z")).toBe("10/09/2026 23:30");
  });

  it("devolve travessao quando nao ha data", () => {
    expect(formatarDataHoraBrasilia(null)).toBe("—");
  });

  it("devolve travessao quando a data e invalida", () => {
    expect(formatarDataHoraBrasilia("nao e uma data")).toBe("—");
  });
});

describe("formatarDataBrasilia", () => {
  it("mostra so o dia, sem horario", () => {
    expect(formatarDataBrasilia("2026-09-11T02:30:00.000Z")).toBe("10/09/2026");
  });

  it("devolve travessao quando nao ha data", () => {
    expect(formatarDataBrasilia(undefined)).toBe("—");
  });
});

describe("formatarNumero", () => {
  it("usa ponto como separador de milhar, no padrao brasileiro", () => {
    expect(formatarNumero(12345)).toBe("12.345");
  });

  it("mostra zero como zero, e nao como travessao", () => {
    expect(formatarNumero(0)).toBe("0");
  });
});

describe("rotuloStatusSolicitacao", () => {
  it("traduz os status gravados em solicitacoes_busca", () => {
    expect(rotuloStatusSolicitacao("em_andamento").texto).toBe("Em andamento");
    expect(rotuloStatusSolicitacao("concluido").texto).toBe("Concluído");
    expect(rotuloStatusSolicitacao("pendente").texto).toBe("Pendente");
    expect(rotuloStatusSolicitacao("cancelado").texto).toBe("Cancelado");
  });

  /** A tabela nao tem mais CHECK em status: um valor novo nao pode quebrar o PDF. */
  it("repassa um status desconhecido em vez de sumir com ele", () => {
    expect(rotuloStatusSolicitacao("arquivado").texto).toBe("arquivado");
  });

  it("da uma cor RGB a cada status, para o badge do PDF", () => {
    expect(rotuloStatusSolicitacao("concluido").cor).toHaveLength(3);
  });
});

describe("rotuloStatusAprovacao", () => {
  it("traduz o status do cadastro da empresa", () => {
    expect(rotuloStatusAprovacao("aprovado").texto).toBe("Aprovado");
    expect(rotuloStatusAprovacao("pendente").texto).toBe("Pendente");
    expect(rotuloStatusAprovacao("suspenso").texto).toBe("Suspenso");
  });

  it("descreve a ausencia de status em vez de deixar vazio", () => {
    expect(rotuloStatusAprovacao(null).texto).toBe("Não informado");
  });
});
