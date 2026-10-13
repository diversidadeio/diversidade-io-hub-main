/** Máscara em centavos, sem converter para Number para não perder precisão. */
export function formatarParticipacaoMonetaria(valor: string, anterior = ""): string {
  const entrada = valor.replace(/R\$/g, "").trim();
  if (!/^[\d.,\s]*$/.test(entrada)) return anterior;
  const digitos = entrada.replace(/\D/g, "");
  if (!digitos) return "";
  const centavos = digitos.replace(/^0+/, "").padStart(3, "0");
  const inteiro = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${inteiro},${centavos.slice(-2)}`;
}

export function filtrarPercentual(valor: string, anterior = ""): string {
  const entrada = valor.replace(".", ",");
  return /^\d*(,\d{0,2})?$/.test(entrada) ? entrada : anterior;
}

export function filtrarIdade(valor: string, anterior = ""): string {
  return /^\d*$/.test(valor) ? valor : anterior;
}
