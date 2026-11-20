/**
 * mascaras.ts
 *
 * Máscaras de digitação (formatam enquanto a pessoa digita) e o helper que
 * aplica a máscara num <input> preservando a posição do cursor.
 *
 * Os separadores só aparecem quando já existe caractere depois deles, então
 * apagar do fim para o começo funciona sem "travar" em pontos e traços.
 */
import type { ChangeEvent } from "react";

/**
 * Função que formata o texto digitado. `cursorNoFim` marca máscaras em que os dígitos entram pela
 * direita (valor em reais): o cursor fica sempre no fim, porque o texto formatado muda de tamanho
 * e "mesma posição de antes" deixaria o cursor no meio do número.
 */
export type Mascara = ((valor: string) => string) & { cursorNoFim?: boolean };

/** (16) 99303-6103 · (16) 3303-6103. Ignora o +55 do autopreenchimento e de textos colados. */
export const mascaraTelefone: Mascara = (valor) => {
  let d = valor.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  const corte = numero.length === 9 ? 5 : 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
};

/** 12.345.678/0001-90 — aceita o CNPJ alfanumérico (letras nas 12 primeiras posições). */
export const mascaraCnpj: Mascara = (valor) => {
  const s = valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  let r = s.slice(0, 2);
  if (s.length > 2) r += `.${s.slice(2, 5)}`;
  if (s.length > 5) r += `.${s.slice(5, 8)}`;
  if (s.length > 8) r += `/${s.slice(8, 12)}`;
  if (s.length > 12) r += `-${s.slice(12, 14)}`;
  return r;
};

/** Valor em reais digitado como em caixa eletrônico: 150000 → 1.500,00 */
export const mascaraMoeda: Mascara = Object.assign(
  (valor: string) => {
    const d = valor.replace(/\D/g, "").replace(/^0+/, "").slice(0, 14);
    if (!d) return "";
    const centavos = d.padStart(3, "0");
    const inteiro = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${inteiro},${centavos.slice(-2)}`;
  },
  { cursorNoFim: true },
);

/** Só algarismos, com limite de tamanho (ex.: número da nota fiscal). */
export const mascaraDigitos =
  (maximo: number): Mascara =>
  (valor) =>
    valor.replace(/\D/g, "").slice(0, maximo);

/** Série da nota: letras maiúsculas, números e hífen, até 12 caracteres. */
export const mascaraSerieNota: Mascara = (valor) => valor.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);

const SIGNIFICATIVO = /[A-Za-z0-9]/;
const contarSignificativos = (s: string) => [...s].filter((c) => SIGNIFICATIVO.test(c)).length;

/**
 * Reaplica a máscara no campo mantendo o cursor depois do mesmo caractere
 * digitado. Backspace logo depois de um separador apaga o caractere anterior a ele.
 */
export function aplicarMascara(campo: HTMLInputElement, mascara: Mascara, tipoEntrada?: string) {
  let valor = campo.value;
  let cursor = campo.selectionStart ?? valor.length;

  if (tipoEntrada === "deleteContentBackward" && campo.dataset.mascarado !== undefined && mascara(valor) === campo.dataset.mascarado) {
    let i = cursor - 1;
    while (i >= 0 && !SIGNIFICATIVO.test(valor[i])) i--;
    if (i >= 0) {
      valor = valor.slice(0, i) + valor.slice(i + 1);
      cursor = i;
    }
  }

  const antesDoCursor = contarSignificativos(valor.slice(0, cursor));
  const formatado = mascara(valor);
  campo.value = formatado;
  campo.dataset.mascarado = formatado;

  let posicao = 0;
  if (mascara.cursorNoFim) {
    posicao = formatado.length;
  } else {
    for (let vistos = 0; posicao < formatado.length && vistos < antesDoCursor; posicao++) {
      if (SIGNIFICATIVO.test(formatado[posicao])) vistos++;
    }
  }
  if (typeof document !== "undefined" && document.activeElement === campo) campo.setSelectionRange(posicao, posicao);
}

/** Para usar em onChange: aplica a máscara e devolve o valor formatado. */
export function mascarar(evento: ChangeEvent<HTMLInputElement>, mascara: Mascara) {
  aplicarMascara(evento.currentTarget, mascara, (evento.nativeEvent as InputEvent).inputType);
  return evento.currentTarget.value;
}
