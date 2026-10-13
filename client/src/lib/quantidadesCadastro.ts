/** Preserva zero e mantém valores ausentes distintos de uma quantidade informada. */
export function quantidadeParaTexto(valor: number | string | null | undefined): string {
  return valor == null ? "" : String(valor);
}

export function lerQuantidadeSalva(valor: unknown): number | "" {
  if (valor == null || valor === "" || typeof valor === "boolean") return "";
  if (typeof valor !== "string" && typeof valor !== "number") return "";
  if (!/^\d+$/.test(String(valor))) return "";
  const quantidade = Number(valor);
  return Number.isSafeInteger(quantidade) ? quantidade : "";
}
