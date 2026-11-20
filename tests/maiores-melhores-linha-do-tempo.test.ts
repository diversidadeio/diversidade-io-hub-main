import { describe, expect, it } from "vitest";
import { agruparPorDia, montarLinhaDoTempo } from "@/components/adm/maiores-melhores/linhaDoTempo";
import type { MmEmpresa, MmNegocio } from "@/lib/maioresMelhores";

const agora = Date.parse("2026-11-25T12:00:00Z");

const empresa: MmEmpresa = {
  id: "e1",
  evento_id: "ev",
  categoria: "afro",
  porte: "Micro",
  razao_social: "Axé Comunicação",
  cnpj: "11222333000181",
  responsavel: "Luana",
  email: "contato@axe.example",
  municipio: "Salvador",
  uf: "BA",
  socios: [],
  criado_em: "2026-11-19T13:00:00Z",
};

function negocio(extra: Partial<MmNegocio>): MmNegocio {
  return {
    id: "n1",
    evento_id: "ev",
    empresa_id: "e1",
    perfil_parceiro: "media",
    cnpj_comprador: "99888777000166",
    cnpj_vendedor: empresa.cnpj,
    cnpj_parceiro: "99888777000166",
    razao_social_parceiro: "Clínica Bem Estar Ltda",
    data_emissao: "2026-11-10",
    valor_centavos: 150000,
    numero_nota: "123",
    serie_nota: "1",
    email_comprador: "compras@clinica.example",
    whatsapp_comprador: null,
    token_expira_em: "2026-11-27T13:00:00Z",
    resposta_comprador: null,
    observacao_comprador: null,
    respondido_em: null,
    status: "pendente",
    motivo: "",
    revisado_por: null,
    revisado_em: null,
    criado_em: "2026-11-20T13:00:00Z",
    ...extra,
  };
}

describe("linha do tempo da empresa", () => {
  it("começa pela inscrição, com quem inscreveu", () => {
    const eventos = montarLinhaDoTempo(empresa, [], { nome: "Luana Conceição" }, agora);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "inscricao", quando: empresa.criado_em });
    expect(eventos[0].detalhe).toBe("Luana Conceição inscreveu a empresa na categoria Afroempreendedores (Micro).");
  });

  it("mostra registro, confirmação e validação do mais recente para o mais antigo", () => {
    const n = negocio({
      resposta_comprador: "confirmado",
      respondido_em: "2026-11-21T10:00:00Z",
      status: "validado",
      revisado_por: "tecnologia@diversidade.io",
      revisado_em: "2026-11-22T09:00:00Z",
    });
    const eventos = montarLinhaDoTempo(empresa, [n], null, agora);
    expect(eventos.map((e) => e.tipo)).toEqual(["validado", "confirmado", "registro", "inscricao"]);
    expect(eventos[0]).toMatchObject({ titulo: "Nota 123 · série 1 validada", negocioId: "n1" });
    expect(eventos[0].detalhe).toContain("Por tecnologia@diversidade.io.");
    expect(eventos[2].titulo).toBe("Nota 123 · série 1 registrada");
    expect(eventos[2].detalhe).toContain("Venda para Clínica Bem Estar Ltda");
    expect(eventos[2].detalhe).toContain("emitida em 10/11/2026");
  });

  it("descreve compra quando a inscrita é a compradora", () => {
    const n = negocio({ cnpj_comprador: empresa.cnpj, cnpj_vendedor: "99888777000166", perfil_parceiro: "afro" });
    const registro = montarLinhaDoTempo(empresa, [n], null, agora).find((e) => e.tipo === "registro")!;
    expect(registro.detalhe).toMatch(/^Compra de Clínica Bem Estar Ltda/);
  });

  it("traz a divergência com a observação do comprador e o indeferimento com motivo", () => {
    const n = negocio({
      resposta_comprador: "divergencia",
      observacao_comprador: "O valor correto é R$ 1.200,00.",
      respondido_em: "2026-11-21T10:00:00Z",
      status: "indeferido",
      motivo: "Valor diferente do declarado.",
      revisado_por: "adm@diversidade.io",
      revisado_em: "2026-11-21T15:00:00Z",
    });
    const eventos = montarLinhaDoTempo(empresa, [n], null, agora);
    const divergencia = eventos.find((e) => e.tipo === "divergencia")!;
    expect(divergencia.titulo).toBe("Comprador apontou divergência na nota 123 · série 1");
    expect(divergencia.detalhe).toContain("O valor correto é R$ 1.200,00.");
    expect(eventos.find((e) => e.tipo === "indeferido")!.detalhe).toBe("Por adm@diversidade.io. Motivo: Valor diferente do declarado.");
  });

  it("marca link vencido só quando não houve resposta e o prazo passou", () => {
    const vencido = negocio({ id: "n2", token_expira_em: "2026-11-24T00:00:00Z" });
    const valendo = negocio({ id: "n3", numero_nota: "124" });
    const eventos = montarLinhaDoTempo(empresa, [vencido, valendo], null, agora);
    expect(eventos.filter((e) => e.tipo === "vencido").map((e) => e.negocioId)).toEqual(["n2"]);
  });

  it("revisão que voltou para análise aparece como reaberta", () => {
    const n = negocio({ resposta_comprador: "confirmado", respondido_em: "2026-11-21T10:00:00Z", revisado_em: "2026-11-23T10:00:00Z", revisado_por: "adm@x" });
    const reaberto = montarLinhaDoTempo(empresa, [n], null, agora)[0];
    expect(reaberto).toMatchObject({ tipo: "reaberto", titulo: "Nota 123 · série 1 voltou para análise" });
  });

  it("ignora negócios de outras empresas e agrupa por dia no fuso de São Paulo", () => {
    const outra = negocio({ id: "x", empresa_id: "e2" });
    const tarde = negocio({ criado_em: "2026-11-21T02:30:00Z" }); // 20/11 23:30 em São Paulo
    const eventos = montarLinhaDoTempo(empresa, [outra, tarde], null, agora);
    expect(eventos.some((e) => e.negocioId === "x")).toBe(false);
    expect(agruparPorDia(eventos).map((g) => [g.dia, g.eventos.length])).toEqual([
      ["2026-11-20", 1],
      ["2026-11-19", 1],
    ]);
  });
});
