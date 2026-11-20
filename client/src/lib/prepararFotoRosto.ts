/**
 * prepararFotoRosto.ts
 *
 * Confere a assinatura do arquivo (JPEG/PNG) e, se a foto passar de 12 MB,
 * reduz no navegador antes do envio para o bucket privado.
 */
/** Mesmo limite do bucket privado (migration 39). */
export const TAMANHO_MAXIMO_FOTO = 12 * 1024 * 1024;

export async function tipoDaFoto(arquivo: File): Promise<"image/jpeg" | "image/png" | null> {
  const bytes = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  const comeca = (assinatura: number[]) => assinatura.every((byte, i) => bytes[i] === byte);
  if (arquivo.type === "image/jpeg" && comeca([255, 216, 255])) return "image/jpeg";
  if (arquivo.type === "image/png" && comeca([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  return null;
}

export async function prepararFotoRosto(arquivo: File): Promise<File> {
  if (!(await tipoDaFoto(arquivo))) throw new Error("Escolha uma imagem JPEG ou PNG válida.");
  if (arquivo.size <= TAMANHO_MAXIMO_FOTO) return arquivo;

  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d", { alpha: false });
    if (!contexto || !imagem.naturalWidth || !imagem.naturalHeight) throw new Error();

    const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
    for (const [lado, qualidade] of [[2048, 0.9], [1600, 0.85], [1200, 0.8]]) {
      const escala = Math.min(1, lado / maiorLado);
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      contexto.fillStyle = "#fff";
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
      if (blob?.type === "image/jpeg" && blob.size > 0 && blob.size <= TAMANHO_MAXIMO_FOTO) {
        return new File([blob], `${arquivo.name.replace(/\.[^.]*$/, "")}.jpg`, { type: "image/jpeg" });
      }
    }
  } catch {
    // Mantém a foto original fora do envio; o participante pode escolher outra.
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error("Não foi possível reduzir esta foto. Escolha outra imagem ou remova a foto para continuar.");
}
