/**
 * validacao.ts
 *
 * Regras de preenchimento dos formulários públicos do Maiores & Melhores. Cada função devolve um
 * objeto com UMA mensagem por campo com problema (campo sem problema não aparece). A tela usa isso
 * para pintar o campo de vermelho e mostrar a mensagem embaixo dele.
 *
 * O banco aplica as mesmas regras (migrations 34 a 38) e é quem decide; aqui elas existem para a
 * pessoa ver, de uma vez, tudo o que falta, antes de enviar.
 */
import { cnpjValido, converterValorEmCentavos, hojeSaoPaulo } from "@/lib/maioresMelhores";

/** Chave = identificador do campo; valor = mensagem. Só tem os campos com problema. */
export type Erros = Record<string, string>;

const vazio = (valor: unknown) => String(valor ?? "").trim() === "";

/** AAAA-MM-DD que existe de verdade (rejeita 30/02, que o Date.parse aceitaria como 02/03). */
function dataExiste(valor: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export const emailValido = (valor: string) => {
  const v = valor.trim();
  return v.length <= 180 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v);
};

/** DDD + número (10 ou 11 dígitos). Ignora o +55. */
export function digitosTelefone(valor: string) {
  let d = valor.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}
export const telefoneValido = (valor: string) => [10, 11].includes(digitosTelefone(valor).length);

/** Texto obrigatório com tamanho mínimo. */
function texto(erros: Erros, campo: string, valor: string, ausente: string, minimo = 2) {
  const v = valor.trim();
  if (!v) erros[campo] = ausente;
  else if (v.length < minimo) erros[campo] = `Digite pelo menos ${minimo} letras.`;
}

function email(erros: Erros, campo: string, valor: string, ausente: string) {
  if (vazio(valor)) erros[campo] = ausente;
  else if (!emailValido(valor)) erros[campo] = "Esse e-mail não parece certo. Exemplo: nome@empresa.com.br.";
}

function cnpj(erros: Erros, campo: string, valor: string, ausente: string) {
  if (vazio(valor)) erros[campo] = ausente;
  else if (!cnpjValido(valor)) erros[campo] = "CNPJ inválido. Confira os 14 caracteres e os dígitos finais.";
}

// ───────────────────────────────────────────────────────────────────────────
// Primeiro acesso e recuperação
// ───────────────────────────────────────────────────────────────────────────

export function validarPrimeiroAcesso(d: { nome: string; email: string; telefone: string }): Erros {
  const erros: Erros = {};
  texto(erros, "nome", d.nome, "Informe seu nome completo.");
  email(erros, "email", d.email, "Informe seu e-mail.");
  if (vazio(d.telefone)) erros.telefone = "Informe seu telefone com DDD.";
  else if (!telefoneValido(d.telefone)) erros.telefone = "Telefone incompleto. Informe o DDD e o número. Exemplo: (11) 99999-9999.";
  return erros;
}

export function validarRecuperacao(d: { cnpj: string }): Erros {
  const erros: Erros = {};
  cnpj(erros, "cnpj", d.cnpj, "Informe o CNPJ da empresa inscrita.");
  return erros;
}

// ───────────────────────────────────────────────────────────────────────────
// Inscrição da empresa (nova ou edição)
// ───────────────────────────────────────────────────────────────────────────

export interface SocioParaValidar {
  /** Identificador estável da linha na tela (usado na chave do erro). */
  chave: number;
  nome: string;
  declaracao: string;
  /** Escolheu uma foto nova para enviar. */
  temFotoNova: boolean;
  autorizouFoto: boolean;
  /** É o responsável pela inscrição (1º sócio na categoria afro): o nome vem do campo "responsável". */
  ehResponsavel: boolean;
}

export interface InscricaoParaValidar {
  /** Na edição o CNPJ não muda, então não é conferido. */
  edicao: boolean;
  categoria: "afro" | "inclusiva";
  porte: string;
  razao_social: string;
  cnpj: string;
  responsavel: string;
  email: string;
  municipio: string;
  uf: string;
  consentimento: boolean;
  socios: SocioParaValidar[];
}

/**
 * Chaves de erro: porte, razao_social, cnpj, responsavel, email, municipio, uf, consentimento,
 * `socio:<chave>` (nome do sócio), `autorizacao:<chave>` (autorização da foto) e `socios`
 * (nenhum sócio preto ou pardo na categoria Afroempreendedores).
 */
export function validarInscricao(d: InscricaoParaValidar): Erros {
  const erros: Erros = {};
  if (vazio(d.porte)) erros.porte = "Selecione o porte da empresa.";
  texto(erros, "razao_social", d.razao_social, "Informe a razão social da empresa.");
  if (!d.edicao) cnpj(erros, "cnpj", d.cnpj, "Informe o CNPJ da empresa.");
  texto(erros, "responsavel", d.responsavel, "Informe o nome do responsável pela inscrição.");
  email(erros, "email", d.email, "Informe o e-mail de contato.");
  texto(erros, "municipio", d.municipio, "Informe o município.");
  if (vazio(d.uf)) erros.uf = "Selecione a UF.";

  for (const s of d.socios) {
    if (!s.ehResponsavel) texto(erros, `socio:${s.chave}`, s.nome, "Informe o nome do sócio ou titular.");
    if (s.temFotoNova && !s.autorizouFoto) erros[`autorizacao:${s.chave}`] = "Marque a autorização para poder enviar esta foto.";
  }
  if (d.categoria === "afro" && !d.socios.some((s) => s.declaracao === "preta_parda")) {
    erros.socios = "Informe pelo menos um sócio ou titular com autodeclaração preta ou parda.";
  }

  if (!d.consentimento) erros.consentimento = "Marque a declaração de veracidade para salvar a inscrição.";
  return erros;
}

// ───────────────────────────────────────────────────────────────────────────
// Registro de negócio (nota fiscal)
// ───────────────────────────────────────────────────────────────────────────

export interface NegocioParaValidar {
  cnpj_comprador: string;
  cnpj_vendedor: string;
  razao_social_parceiro: string;
  data_emissao: string;
  valor: string;
  numero_nota: string;
  serie_nota: string;
  email_comprador: string;
  whatsapp_comprador: string;
  /** Qual dos dois CNPJs é o da empresa inscrita (já preenchido e travado na tela). */
  papelDaInscrita: "comprador" | "vendedor";
  hoje?: string;
}

export function validarNegocio(d: NegocioParaValidar): Erros {
  const erros: Erros = {};
  cnpj(erros, "cnpj_comprador", d.cnpj_comprador, "Informe o CNPJ da empresa compradora.");
  cnpj(erros, "cnpj_vendedor", d.cnpj_vendedor, "Informe o CNPJ da empresa vendedora.");

  const a = d.cnpj_comprador.replace(/[./\s-]/g, "").toUpperCase();
  const b = d.cnpj_vendedor.replace(/[./\s-]/g, "").toUpperCase();
  if (a && b && a === b && !erros.cnpj_comprador && !erros.cnpj_vendedor) {
    // O campo da empresa inscrita é travado: quem corrige é o CNPJ da parceira.
    erros[d.papelDaInscrita === "comprador" ? "cnpj_vendedor" : "cnpj_comprador"] =
      "O CNPJ da parceira não pode ser igual ao da sua empresa. Informe o CNPJ da outra empresa da nota.";
  }

  texto(erros, "razao_social_parceiro", d.razao_social_parceiro, "Informe a razão social da empresa parceira.");

  if (vazio(d.data_emissao)) erros.data_emissao = "Informe a data de emissão da nota.";
  else if (!dataExiste(d.data_emissao)) erros.data_emissao = "Data inválida. Escolha uma data no calendário.";
  else if (d.data_emissao > (d.hoje ?? hojeSaoPaulo())) erros.data_emissao = "A data de emissão não pode ser depois de hoje.";

  if (vazio(d.valor)) erros.valor = "Informe o valor total da nota. Exemplo: 1.500,00.";
  else {
    const centavos = converterValorEmCentavos(d.valor);
    if (!Number.isSafeInteger(centavos) || centavos <= 0) erros.valor = "O valor da nota precisa ser maior que zero.";
  }

  if (vazio(d.numero_nota)) erros.numero_nota = "Informe o número da nota fiscal.";
  else if (!/^\d{1,15}$/.test(d.numero_nota.trim())) erros.numero_nota = "Use só algarismos, com até 15 dígitos.";

  if (!vazio(d.serie_nota) && !/^[A-Za-z0-9-]{1,12}$/.test(d.serie_nota.trim())) {
    erros.serie_nota = "Use até 12 letras, números ou hífens.";
  }

  email(erros, "email_comprador", d.email_comprador, "Informe o e-mail corporativo do comprador.");

  if (!vazio(d.whatsapp_comprador) && !telefoneValido(d.whatsapp_comprador)) {
    erros.whatsapp_comprador = "WhatsApp incompleto. Informe o DDD e o número, ou deixe em branco.";
  }
  return erros;
}

// ───────────────────────────────────────────────────────────────────────────
// Resposta do comprador
// ───────────────────────────────────────────────────────────────────────────

export function validarRespostaComprador(d: { resposta: string; observacao: string }): Erros {
  const erros: Erros = {};
  if (d.resposta === "divergencia" && vazio(d.observacao)) erros.observacao = "Descreva a divergência encontrada.";
  return erros;
}
