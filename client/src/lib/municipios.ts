/**
 * municipios.ts
 *
 * A BrasilAPI devolve o município em maiúsculas e sem acento ("SAO PAULO").
 * Aqui o nome é trocado pelo nome oficial do IBGE ("São Paulo"), buscando a
 * lista de municípios da UF uma única vez por sessão.
 */

const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "SANTA BARBARA D'OESTE" → "Santa Barbara d'Oeste". Usado quando o IBGE não responde. */
export function nomeProprio(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((palavra, i) => {
      if (i > 0 && LIGACOES.has(palavra)) return palavra;
      return palavra.replace(/(^|['’-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase("pt-BR"));
    })
    .join(" ")
    .replace(/\bD'O/g, "d'O");
}

/** Chave de comparação: sem acento, sem pontuação, maiúscula. */
export const chaveMunicipio = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const listas = new Map<string, Promise<Map<string, string> | null>>();

function carregarLista(uf: string) {
  let lista = listas.get(uf);
  if (!lista) {
    lista = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
          signal: controller.signal,
        });
        if (!resposta.ok) return null;
        const itens = (await resposta.json()) as { nome?: string }[];
        const mapa = new Map<string, string>();
        for (const item of itens) if (item.nome) mapa.set(chaveMunicipio(item.nome), item.nome);
        return mapa.size ? mapa : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })();
    listas.set(uf, lista);
    // Falha não fica em cache: a próxima consulta tenta de novo.
    void lista.then((mapa) => {
      if (!mapa) listas.delete(uf);
    });
  }
  return lista;
}

/** Nome oficial do município; se o IBGE estiver fora do ar, devolve o nome com iniciais maiúsculas. */
export async function nomeOficialMunicipio(uf: string, nome: string): Promise<string> {
  const lista = await carregarLista(uf.toUpperCase());
  return lista?.get(chaveMunicipio(nome)) ?? nomeProprio(nome);
}
