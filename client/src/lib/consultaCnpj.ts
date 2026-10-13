export type MotivoConsultaCnpj = "INVALIDO" | "NAO_ENCONTRADO" | "INDISPONIVEL";

export class ErroConsultaCnpj extends Error {
  constructor(public motivo: MotivoConsultaCnpj) {
    super(motivo);
  }
}

export interface DadosCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo: number; descricao?: string }[];
  qsa?: { nome_socio: string }[];
}

export function validarDigitosCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcular = (base: string, pesos: number[]) => {
    const resto = [...base].reduce((soma, digito, i) => soma + Number(digito) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = calcular(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcular(cnpj.slice(0, 12) + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

/** Consulta fontes públicas independentes; falha técnica não significa CNPJ inexistente. */
export async function consultarCnpj(cnpj: string): Promise<DadosCnpj> {
  if (!validarDigitosCnpj(cnpj)) throw new ErroConsultaCnpj("INVALIDO");
  const fontes = [
    `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    `https://open.cnpja.com/office/${cnpj}`,
  ];
  let naoEncontrados = 0;
  for (const [index, url] of fontes.entries()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resposta = await fetch(url, { signal: controller.signal });
      if (resposta.status === 404) {
        naoEncontrados++;
        continue;
      }
      if (!resposta.ok) continue;
      const origem = await resposta.json();
      const dados: DadosCnpj = index === 0 ? origem : {
        cnpj: origem.taxId,
        razao_social: origem.company?.name,
        nome_fantasia: origem.alias,
        cnae_fiscal: origem.mainActivity?.id,
        cnae_fiscal_descricao: origem.mainActivity?.text,
        cnaes_secundarios: origem.sideActivities?.map((atividade: { id: number; text: string }) => ({ codigo: atividade.id, descricao: atividade.text })),
        qsa: origem.company?.members?.map((membro: { person?: { name?: string } }) => ({ nome_socio: membro.person?.name ?? "" })),
      };
      if (String(dados.cnpj).replace(/\D/g, "") !== cnpj || !dados.razao_social?.trim()) continue;
      return dados;
    } catch {
      // Rede, timeout e resposta inválida: tenta a próxima fonte sem invalidar o CNPJ.
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new ErroConsultaCnpj(naoEncontrados === fontes.length ? "NAO_ENCONTRADO" : "INDISPONIVEL");
}
