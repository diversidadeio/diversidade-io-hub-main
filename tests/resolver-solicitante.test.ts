/**
 * O painel de Solicitacoes de Busca exibia `empresas.email` (o contato do
 * cadastro da empresa) logo abaixo da razao social, sem rotulo — o que se lia
 * como "quem pediu a busca". Quem realmente abriu a solicitacao esta em
 * `solicitacoes_busca.usuario_id`, que guarda o `auth_user_id` do membro em
 * `empresa_usuarios` (ambos os modais gravam esse campo).
 *
 * Caso real: a solicitacao de 10/09/2026 do Sebrae tinha
 * usuario_id -> jesse.silva@sebrae.com.br, mas a tela mostrava
 * andreive.sousa@sebrae.com.br (o responsavel do cadastro), divergindo do log
 * de auditoria, que grava o autor a partir do token JWT.
 */
import { describe, expect, it } from "vitest";
import { resolverSolicitante } from "../client/src/lib/oportunidade";

const MEMBROS = [
  {
    id: "128a2673-5e44-4c93-813c-3fc2da679860",
    auth_user_id: "621a1ca3-e498-4824-b06a-abaeb6696841",
    nome: "Andreive Ribeiro Souza",
    email: "andreive.sousa@sebrae.com.br",
  },
  {
    id: "f21c0df0-7a51-4d46-9e0a-80340bbdaeec",
    auth_user_id: "17119dcd-a0b9-4035-81de-7cbba117fbe8",
    nome: "Jesse Paiva Silva",
    email: "jesse.silva@sebrae.com.br",
  },
];

describe("resolverSolicitante", () => {
  it("resolve o membro pelo auth_user_id gravado em usuario_id", () => {
    expect(resolverSolicitante("17119dcd-a0b9-4035-81de-7cbba117fbe8", MEMBROS)).toEqual({
      nome: "Jesse Paiva Silva",
      email: "jesse.silva@sebrae.com.br",
    });
  });

  it("nao devolve o responsavel do cadastro quando outro membro fez o pedido", () => {
    const solicitante = resolverSolicitante("17119dcd-a0b9-4035-81de-7cbba117fbe8", MEMBROS);
    expect(solicitante.email).not.toBe("andreive.sousa@sebrae.com.br");
  });

  it("tambem resolve quando usuario_id guarda o id da linha de empresa_usuarios", () => {
    // Defensivo: linhas antigas podem ter gravado o id da linha em vez do auth_user_id.
    expect(resolverSolicitante("f21c0df0-7a51-4d46-9e0a-80340bbdaeec", MEMBROS)).toEqual({
      nome: "Jesse Paiva Silva",
      email: "jesse.silva@sebrae.com.br",
    });
  });

  it("devolve nulos quando a solicitacao nao tem usuario_id", () => {
    expect(resolverSolicitante(null, MEMBROS)).toEqual({ nome: null, email: null });
  });

  it("devolve nulos quando o usuario nao esta mais vinculado a empresa", () => {
    expect(resolverSolicitante("00000000-0000-0000-0000-000000000000", MEMBROS)).toEqual({
      nome: null,
      email: null,
    });
  });

  it("nao quebra com lista de membros vazia", () => {
    expect(resolverSolicitante("17119dcd-a0b9-4035-81de-7cbba117fbe8", [])).toEqual({
      nome: null,
      email: null,
    });
  });
});
