import { describe, expect, it } from "vitest";
import {
  type InscricaoParaValidar,
  type NegocioParaValidar,
  digitosTelefone,
  emailValido,
  telefoneValido,
  validarInscricao,
  validarNegocio,
  validarPrimeiroAcesso,
  validarRecuperacao,
  validarRespostaComprador,
} from "../client/src/lib/validacao";

describe("e-mail e telefone", () => {
  it("valida e-mail", () => {
    for (const ok of ["a@b.co", "nome.sobrenome@empresa.com.br", "  x@y.org  "]) expect(emailValido(ok), ok).toBe(true);
    for (const ruim of ["", "sem-arroba", "a@b", "a@b.", "a b@c.com", "@c.com", "a@@c.com", "a@b.c", `${"x".repeat(180)}@a.com`]) expect(emailValido(ruim), ruim).toBe(false);
  });

  it("valida telefone com DDD e ignora o +55", () => {
    expect(telefoneValido("(16) 99303-6103")).toBe(true);
    expect(telefoneValido("(16) 3303-6103")).toBe(true);
    expect(telefoneValido("+55 16 99303-6103")).toBe(true);
    expect(telefoneValido("(16) 9930")).toBe(false);
    expect(telefoneValido("")).toBe(false);
    expect(digitosTelefone("+55 (16) 99303-6103")).toBe("16993036103");
  });
});

describe("primeiro acesso e recuperação", () => {
  it("aponta cada campo que falta", () => {
    expect(Object.keys(validarPrimeiroAcesso({ nome: "", email: "", telefone: "" })).sort()).toEqual(["email", "nome", "telefone"]);
    expect(validarPrimeiroAcesso({ nome: "Ana Souza", email: "ana@x.com", telefone: "(11) 99999-8888" })).toEqual({});
  });

  it("mensagens diferentes para vazio e para formato errado", () => {
    const vazio = validarPrimeiroAcesso({ nome: "", email: "", telefone: "" });
    const ruim = validarPrimeiroAcesso({ nome: "A", email: "ana@", telefone: "(11) 9999" });
    expect(vazio.nome).toBe("Informe seu nome completo.");
    expect(ruim.nome).toMatch(/pelo menos 2 letras/);
    expect(vazio.email).toBe("Informe seu e-mail.");
    expect(ruim.email).toMatch(/não parece certo/);
    expect(vazio.telefone).toBe("Informe seu telefone com DDD.");
    expect(ruim.telefone).toMatch(/incompleto/);
  });

  it("recuperação exige CNPJ válido", () => {
    expect(validarRecuperacao({ cnpj: "" }).cnpj).toMatch(/Informe o CNPJ/);
    expect(validarRecuperacao({ cnpj: "45.428.188/0001-02" }).cnpj).toMatch(/inválido/);
    expect(validarRecuperacao({ cnpj: "45.428.188/0001-01" })).toEqual({});
    expect(validarRecuperacao({ cnpj: "12.ABC.345/01DE-35" })).toEqual({});
  });
});

const socio = (extra = {}) => ({ chave: 0, nome: "Marcelo", declaracao: "preta_parda", temFotoNova: false, autorizouFoto: false, ehResponsavel: true, ...extra });
const inscricao = (extra: Partial<InscricaoParaValidar> = {}): InscricaoParaValidar => ({
  edicao: false, categoria: "afro", porte: "MEI", razao_social: "Empresa Teste", cnpj: "45.428.188/0001-01", responsavel: "Marcelo",
  email: "contato@empresa.com", municipio: "São Paulo", uf: "SP", consentimento: true, socios: [socio()], ...extra,
});

describe("inscrição da empresa", () => {
  it("inscrição completa não tem erros", () => {
    expect(validarInscricao(inscricao())).toEqual({});
  });

  it("formulário vazio mostra todos os obrigatórios de uma vez", () => {
    const erros = validarInscricao(inscricao({ porte: "", razao_social: "", cnpj: "", responsavel: "", email: "", municipio: "", uf: "", consentimento: false, socios: [socio({ declaracao: "nao_informada" })] }));
    expect(Object.keys(erros).sort()).toEqual(["cnpj", "consentimento", "email", "municipio", "porte", "razao_social", "responsavel", "socios", "uf"]);
    expect(erros.consentimento).toMatch(/veracidade/);
    expect(erros.socios).toMatch(/preta ou parda/);
  });

  it("CNPJ inválido é diferente de CNPJ em branco; na edição o CNPJ não é conferido", () => {
    expect(validarInscricao(inscricao({ cnpj: "" })).cnpj).toBe("Informe o CNPJ da empresa.");
    expect(validarInscricao(inscricao({ cnpj: "11.111.111/0001-00" })).cnpj).toMatch(/inválido/);
    expect(validarInscricao(inscricao({ cnpj: "", edicao: true })).cnpj).toBeUndefined();
  });

  it("sócio extra precisa de nome; o responsável não (o nome vem do campo responsável)", () => {
    const erros = validarInscricao(inscricao({ socios: [socio(), socio({ chave: 1, nome: " ", ehResponsavel: false, declaracao: "outra" })] }));
    expect(erros["socio:1"]).toBe("Informe o nome do sócio ou titular.");
    expect(erros["socio:0"]).toBeUndefined();
  });

  it("foto nova exige autorização do sócio dela", () => {
    const erros = validarInscricao(inscricao({ socios: [socio({ temFotoNova: true }), socio({ chave: 1, nome: "Rui", ehResponsavel: false, declaracao: "outra", temFotoNova: true, autorizouFoto: true })] }));
    expect(erros["autorizacao:0"]).toMatch(/autorização/);
    expect(erros["autorizacao:1"]).toBeUndefined();
  });

  it("afro exige um sócio preto ou pardo; inclusiva não exige sócios", () => {
    expect(validarInscricao(inscricao({ socios: [socio({ declaracao: "outra" })] })).socios).toBeDefined();
    expect(validarInscricao(inscricao({ categoria: "inclusiva", porte: "Grande", socios: [] }))).toEqual({});
  });
});

const hoje = "2026-11-20";
const negocio = (extra: Partial<NegocioParaValidar> = {}): NegocioParaValidar => ({
  cnpj_comprador: "00.000.000/0001-91", cnpj_vendedor: "45.428.188/0001-01", razao_social_parceiro: "Parceira SA", data_emissao: "2026-11-10",
  valor: "1.500,00", numero_nota: "123", serie_nota: "", email_comprador: "compras@parceira.com", whatsapp_comprador: "", papelDaInscrita: "vendedor", hoje, ...extra,
});

describe("registro de negócio", () => {
  it("negócio completo não tem erros; série e WhatsApp são opcionais", () => {
    expect(validarNegocio(negocio())).toEqual({});
    expect(validarNegocio(negocio({ serie_nota: "A-1", whatsapp_comprador: "(11) 98888-7777" }))).toEqual({});
  });

  it("campos vazios aparecem todos juntos", () => {
    const erros = validarNegocio(negocio({ cnpj_comprador: "", razao_social_parceiro: "", data_emissao: "", valor: "", numero_nota: "", email_comprador: "" }));
    expect(Object.keys(erros).sort()).toEqual(["cnpj_comprador", "data_emissao", "email_comprador", "numero_nota", "razao_social_parceiro", "valor"]);
  });

  it("data: obrigatória, válida e não futura", () => {
    expect(validarNegocio(negocio({ data_emissao: "2026-11-21" })).data_emissao).toMatch(/depois de hoje/);
    expect(validarNegocio(negocio({ data_emissao: "2026-11-20" })).data_emissao).toBeUndefined();
    expect(validarNegocio(negocio({ data_emissao: "2026-02-30" })).data_emissao).toMatch(/inválida/);
  });

  it("valor: precisa ser maior que zero", () => {
    expect(validarNegocio(negocio({ valor: "0,00" })).valor).toMatch(/maior que zero/);
    expect(validarNegocio(negocio({ valor: "abc" })).valor).toMatch(/maior que zero/);
    expect(validarNegocio(negocio({ valor: "0,01" })).valor).toBeUndefined();
  });

  it("número da nota: só algarismos até 15; série: letras, números e hífen", () => {
    expect(validarNegocio(negocio({ numero_nota: "12a" })).numero_nota).toMatch(/algarismos/);
    expect(validarNegocio(negocio({ numero_nota: "1".repeat(16) })).numero_nota).toMatch(/15/);
    expect(validarNegocio(negocio({ serie_nota: "A B" })).serie_nota).toMatch(/12 letras/);
  });

  it("WhatsApp preenchido incompleto é erro; em branco não", () => {
    expect(validarNegocio(negocio({ whatsapp_comprador: "(11) 9888" })).whatsapp_comprador).toMatch(/incompleto/);
    expect(validarNegocio(negocio({ whatsapp_comprador: "" })).whatsapp_comprador).toBeUndefined();
  });

  it("CNPJs iguais: o erro cai no campo da parceira, que é o editável", () => {
    const igual = "45.428.188/0001-01";
    expect(validarNegocio(negocio({ cnpj_comprador: igual, papelDaInscrita: "vendedor" })).cnpj_comprador).toMatch(/igual ao da sua empresa/);
    expect(validarNegocio(negocio({ cnpj_vendedor: igual, cnpj_comprador: igual, papelDaInscrita: "comprador" })).cnpj_vendedor).toMatch(/igual ao da sua empresa/);
  });

  it("CNPJ da parceira inválido", () => {
    expect(validarNegocio(negocio({ cnpj_comprador: "00.000.000/0001-92" })).cnpj_comprador).toMatch(/inválido/);
  });
});

describe("resposta do comprador", () => {
  it("só a divergência exige descrição", () => {
    expect(validarRespostaComprador({ resposta: "divergencia", observacao: "  " }).observacao).toMatch(/Descreva/);
    expect(validarRespostaComprador({ resposta: "divergencia", observacao: "valor diferente" })).toEqual({});
    expect(validarRespostaComprador({ resposta: "desconhecido", observacao: "" })).toEqual({});
    expect(validarRespostaComprador({ resposta: "confirmado", observacao: "" })).toEqual({});
  });
});
