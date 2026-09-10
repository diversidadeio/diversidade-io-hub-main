/**
 * Funcoes puras que montam o Relatorio de Auditoria por Empresa (PDF).
 *
 * Ficam em `api/_relatorio.ts` (prefixo `_` = nao vira rota na Vercel, mesmo
 * padrao de `_auth.ts`) porque `api/logs.ts` precisa importa-las com caminho
 * relativo dentro da propria pasta `api/` — ver tests/api-esm-imports.test.ts,
 * que copia so os arquivos de `api/` para carregar sob o resolvedor do Node.
 */
import { describe, expect, it } from "vitest";
import {
  agregarUsuarios,
  janelaDoPeriodo,
  montarLinhasSolicitacoes,
  resumirPeriodo,
  serieAcessos,
} from "../api/_relatorio";

describe("janelaDoPeriodo", () => {
  const agora = new Date("2026-09-10T12:00:00-03:00");

  it("devolve null para 'tudo', porque nao ha corte por data", () => {
    expect(janelaDoPeriodo("tudo", agora)).toBeNull();
  });

  it("volta 30 dias corridos para '30d'", () => {
    expect(janelaDoPeriodo("30d", agora)?.toISOString()).toBe(
      new Date("2026-08-11T12:00:00-03:00").toISOString(),
    );
  });

  it("volta 90 dias corridos para '90d'", () => {
    expect(janelaDoPeriodo("90d", agora)?.toISOString()).toBe(
      new Date("2026-06-12T12:00:00-03:00").toISOString(),
    );
  });

  it("volta 12 meses de calendario para '12m'", () => {
    expect(janelaDoPeriodo("12m", agora)?.toISOString()).toBe(
      new Date("2025-09-10T12:00:00-03:00").toISOString(),
    );
  });

  it("cai no padrao de 90 dias quando o periodo e desconhecido", () => {
    expect(janelaDoPeriodo("banana", agora)?.toISOString()).toBe(
      new Date("2026-06-12T12:00:00-03:00").toISOString(),
    );
  });
});

const MEMBROS = [
  {
    id: "128a2673-5e44-4c93-813c-3fc2da679860",
    auth_user_id: "621a1ca3-e498-4824-b06a-abaeb6696841",
    nome: "Andreive Ribeiro Souza",
    email: "andreive.sousa@sebrae.com.br",
    papel: "admin",
  },
  {
    id: "f21c0df0-7a51-4d46-9e0a-80340bbdaeec",
    auth_user_id: "17119dcd-a0b9-4035-81de-7cbba117fbe8",
    nome: "Jesse Paiva Silva",
    email: "jesse.silva@sebrae.com.br",
    papel: "usuario",
  },
  {
    id: "aaa11111-0000-0000-0000-000000000000",
    auth_user_id: null,
    nome: "Convidado Sem Acesso",
    email: "nunca.entrou@sebrae.com.br",
    papel: "usuario",
  },
];

function log(email: string, tipo_evento: string, criado_em: string) {
  return { email, tipo_evento, criado_em };
}

describe("agregarUsuarios", () => {
  it("conta logins e guarda o acesso mais recente de cada membro", () => {
    const linhas = agregarUsuarios(MEMBROS, [
      log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-01T10:00:00Z"),
      log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-09T10:00:00Z"),
      log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-05T10:00:00Z"),
    ]);

    const jesse = linhas.find((l) => l.email === "jesse.silva@sebrae.com.br");
    expect(jesse?.totalLogins).toBe(3);
    expect(jesse?.ultimoAcesso).toBe("2026-09-09T10:00:00Z");
  });

  it("casa o log com o membro ignorando maiusculas no e-mail", () => {
    const linhas = agregarUsuarios(MEMBROS, [
      log("Jesse.Silva@Sebrae.com.BR", "login_sucesso", "2026-09-09T10:00:00Z"),
    ]);

    expect(linhas.find((l) => l.email === "jesse.silva@sebrae.com.br")?.totalLogins).toBe(1);
  });

  it("separa falhas de login das entradas bem-sucedidas", () => {
    const linhas = agregarUsuarios(MEMBROS, [
      log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-09T10:00:00Z"),
      log("jesse.silva@sebrae.com.br", "login_falha", "2026-09-09T09:58:00Z"),
      log("jesse.silva@sebrae.com.br", "login_falha", "2026-09-09T09:59:00Z"),
    ]);

    const jesse = linhas.find((l) => l.email === "jesse.silva@sebrae.com.br");
    expect(jesse?.totalLogins).toBe(1);
    expect(jesse?.totalFalhas).toBe(2);
  });

  it("marca como inativo quem nao acessou no periodo", () => {
    const linhas = agregarUsuarios(MEMBROS, [
      log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-09T10:00:00Z"),
    ]);

    const ausente = linhas.find((l) => l.email === "nunca.entrou@sebrae.com.br");
    expect(ausente?.ativo).toBe(false);
    expect(ausente?.ultimoAcesso).toBeNull();
    expect(ausente?.totalLogins).toBe(0);
  });

  /** O caso do commit de resolver-solicitante: o autor esta em usuario_id. */
  it("credita a solicitacao ao membro que a abriu, nao ao responsavel do cadastro", () => {
    const linhas = agregarUsuarios(
      MEMBROS,
      [log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-10T10:00:00Z")],
      [{ usuario_id: "17119dcd-a0b9-4035-81de-7cbba117fbe8", criado_em: "2026-09-10T11:00:00Z" }],
    );

    expect(linhas.find((l) => l.email === "jesse.silva@sebrae.com.br")?.totalSolicitacoes).toBe(1);
    expect(linhas.find((l) => l.email === "andreive.sousa@sebrae.com.br")?.totalSolicitacoes).toBe(0);
  });

  it("ordena do acesso mais recente para o mais antigo, com os ausentes no fim", () => {
    const linhas = agregarUsuarios(MEMBROS, [
      log("andreive.sousa@sebrae.com.br", "login_sucesso", "2026-09-02T10:00:00Z"),
      log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-09T10:00:00Z"),
    ]);

    expect(linhas.map((l) => l.email)).toEqual([
      "jesse.silva@sebrae.com.br",
      "andreive.sousa@sebrae.com.br",
      "nunca.entrou@sebrae.com.br",
    ]);
  });

  it("ignora logs de e-mails que nao pertencem a empresa", () => {
    const linhas = agregarUsuarios(MEMBROS, [
      log("estranho@outra.com", "login_sucesso", "2026-09-09T10:00:00Z"),
    ]);

    expect(linhas).toHaveLength(3);
    expect(linhas.every((l) => l.totalLogins === 0)).toBe(true);
  });
});

describe("resumirPeriodo", () => {
  const usuarios = agregarUsuarios(MEMBROS, [
    log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-02T10:00:00Z"),
    log("jesse.silva@sebrae.com.br", "login_sucesso", "2026-09-09T10:00:00Z"),
    log("andreive.sousa@sebrae.com.br", "login_sucesso", "2026-09-05T10:00:00Z"),
    log("jesse.silva@sebrae.com.br", "login_falha", "2026-09-09T09:59:00Z"),
  ]);

  it("separa quem acessou de quem nunca acessou", () => {
    const resumo = resumirPeriodo(usuarios, []);
    expect(resumo.totalUsuarios).toBe(3);
    expect(resumo.usuariosAtivos).toBe(2);
    expect(resumo.usuariosSemAcesso).toBe(1);
  });

  it("soma logins e falhas de todos os membros", () => {
    const resumo = resumirPeriodo(usuarios, []);
    expect(resumo.totalAcessos).toBe(3);
    expect(resumo.totalFalhas).toBe(1);
  });

  it("aponta o acesso mais recente da empresa inteira", () => {
    expect(resumirPeriodo(usuarios, []).ultimoAcesso).toBe("2026-09-09T10:00:00Z");
  });

  it("conta as solicitacoes por status", () => {
    const resumo = resumirPeriodo(usuarios, [
      { status: "pendente", criado_em: "2026-09-01T10:00:00Z" },
      { status: "concluido", criado_em: "2026-09-02T10:00:00Z" },
      { status: "concluido", criado_em: "2026-09-03T10:00:00Z" },
    ]);

    expect(resumo.totalSolicitacoes).toBe(3);
    expect(resumo.solicitacoesPorStatus).toEqual({ pendente: 1, concluido: 2 });
  });

  it("nao quebra quando a empresa nao tem nenhum membro", () => {
    const resumo = resumirPeriodo([], []);
    expect(resumo.totalUsuarios).toBe(0);
    expect(resumo.ultimoAcesso).toBeNull();
  });
});

describe("serieAcessos", () => {
  it("agrupa por dia quando o periodo e curto", () => {
    const serie = serieAcessos(
      [
        log("a@x.com", "login_sucesso", "2026-09-08T13:00:00Z"),
        log("a@x.com", "login_sucesso", "2026-09-10T13:00:00Z"),
        log("b@x.com", "login_sucesso", "2026-09-10T14:00:00Z"),
      ],
      new Date("2026-09-08T00:00:00-03:00"),
      new Date("2026-09-10T23:59:00-03:00"),
    );

    expect(serie).toEqual([
      { rotulo: "08/09", total: 1 },
      { rotulo: "09/09", total: 0 },
      { rotulo: "10/09", total: 2 },
    ]);
  });

  it("agrupa por mes quando o periodo passa de dois meses", () => {
    const serie = serieAcessos(
      [
        log("a@x.com", "login_sucesso", "2026-07-15T13:00:00Z"),
        log("a@x.com", "login_sucesso", "2026-09-01T13:00:00Z"),
      ],
      new Date("2026-07-01T00:00:00-03:00"),
      new Date("2026-09-30T23:59:00-03:00"),
    );

    expect(serie).toEqual([
      { rotulo: "jul/26", total: 1 },
      { rotulo: "ago/26", total: 0 },
      { rotulo: "set/26", total: 1 },
    ]);
  });

  /** A Vercel roda em UTC: um acesso as 22h de Brasilia nao pode cair no dia seguinte. */
  it("agrupa o dia pelo fuso de Brasilia, nao por UTC", () => {
    const serie = serieAcessos(
      [log("a@x.com", "login_sucesso", "2026-09-11T01:30:00Z")],
      new Date("2026-09-10T00:00:00-03:00"),
      new Date("2026-09-11T23:59:00-03:00"),
    );

    expect(serie).toEqual([
      { rotulo: "10/09", total: 1 },
      { rotulo: "11/09", total: 0 },
    ]);
  });

  it("conta so login_sucesso, ignorando outros eventos", () => {
    const serie = serieAcessos(
      [
        log("a@x.com", "login_falha", "2026-09-10T13:00:00Z"),
        log("a@x.com", "usuario_pesquisa_empresa", "2026-09-10T13:00:00Z"),
      ],
      new Date("2026-09-10T00:00:00-03:00"),
      new Date("2026-09-10T23:59:00-03:00"),
    );

    expect(serie).toEqual([{ rotulo: "10/09", total: 0 }]);
  });
});

describe("montarLinhasSolicitacoes", () => {
  const PEDIDO = {
    usuario_id: "17119dcd-a0b9-4035-81de-7cbba117fbe8",
    criado_em: "2026-09-10T11:00:00Z",
    cnaes: ["4711-3/02", "5611-2/01"],
    cidade: "Campinas",
    modalidade: "ambos",
    status: "pendente",
  };

  it("mostra quem abriu o pedido, e nao o responsavel do cadastro", () => {
    const [linha] = montarLinhasSolicitacoes([PEDIDO], MEMBROS);
    expect(linha.autorNome).toBe("Jesse Paiva Silva");
    expect(linha.autorEmail).toBe("jesse.silva@sebrae.com.br");
  });

  /** Pedidos anteriores a migration 25 podem nao ter usuario_id gravado. */
  it("usa travessao quando o autor nao pode ser identificado", () => {
    const [linha] = montarLinhasSolicitacoes([{ ...PEDIDO, usuario_id: null }], MEMBROS);
    expect(linha.autorNome).toBe("—");
    expect(linha.autorEmail).toBe("—");
  });

  it("junta os CNAEs em uma coluna so", () => {
    expect(montarLinhasSolicitacoes([PEDIDO], MEMBROS)[0].cnaes).toBe("4711-3/02, 5611-2/01");
  });

  it("ordena da solicitacao mais recente para a mais antiga", () => {
    const linhas = montarLinhasSolicitacoes(
      [
        { ...PEDIDO, criado_em: "2026-08-01T11:00:00Z", cidade: "Recife" },
        { ...PEDIDO, criado_em: "2026-09-10T11:00:00Z", cidade: "Campinas" },
      ],
      MEMBROS,
    );

    expect(linhas.map((l) => l.cidade)).toEqual(["Campinas", "Recife"]);
  });
});
