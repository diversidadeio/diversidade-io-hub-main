/**
 * oportunidade.ts
 *
 * Utilitários da página compartilhável de oportunidades (/oportunidades/:id).
 * Usado tanto pela página pública quanto pelo painel administrativo e pela
 * área "Minhas Solicitações", para que link, título e prazo sejam calculados
 * do mesmo jeito em todos os lugares.
 */

export interface ResumoOportunidade {
  id: string;
  titulo?: string | null;
  cnaes?: string[] | null;
  cidade?: string | null;
  prazo_final?: string | null;
}

/** Monta a URL absoluta que será compartilhada no WhatsApp / Facebook. */
export function montarLinkOportunidade(id: string): string {
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  return `${origem}/oportunidades/${id}`;
}

/** Título exibido no topo da página; cai para um texto derivado quando vazio. */
export function tituloOportunidade(sol: ResumoOportunidade): string {
  if (sol.titulo && sol.titulo.trim()) return sol.titulo.trim();
  const cnaes = (sol.cnaes || []).filter(Boolean);
  if (cnaes.length > 0) {
    return `Oportunidade para ${cnaes.slice(0, 2).join(" e ")}`;
  }
  return sol.cidade ? `Oportunidade em ${sol.cidade}` : "Oportunidade para empreendedores";
}

export interface InfoPrazo {
  /** Data formatada em pt-BR (ex: 30/09/2026) */
  data: string;
  /** Texto pronto para exibição (ex: "Faltam 5 dias") */
  texto: string;
  /** Classes tailwind de cor do badge */
  cor: string;
  encerrado: boolean;
  diasRestantes: number;
}

/**
 * Calcula quantos dias faltam até o prazo final.
 * Retorna null quando a solicitação não tem prazo definido.
 */
export function infoPrazo(prazoFinal?: string | null): InfoPrazo | null {
  if (!prazoFinal) return null;

  // prazo_final vem como 'YYYY-MM-DD' — monta a data local para não sofrer com fuso
  const [ano, mes, dia] = prazoFinal.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const limite = new Date(ano, mes - 1, dia);

  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diasRestantes = Math.round((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  const data = limite.toLocaleDateString("pt-BR");

  if (diasRestantes < 0) {
    return {
      data,
      texto: "Prazo encerrado",
      cor: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
      encerrado: true,
      diasRestantes,
    };
  }
  if (diasRestantes === 0) {
    return {
      data,
      texto: "Último dia",
      cor: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
      encerrado: false,
      diasRestantes,
    };
  }
  if (diasRestantes <= 3) {
    return {
      data,
      texto: `Faltam ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`,
      cor: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
      encerrado: false,
      diasRestantes,
    };
  }
  return {
    data,
    texto: `Faltam ${diasRestantes} dias`,
    cor: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    encerrado: false,
    diasRestantes,
  };
}

/** Copia um texto para a área de transferência, com fallback para navegadores antigos. */
export async function copiarParaAreaDeTransferencia(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}

/** Mensagem sugerida para colar no WhatsApp / redes sociais. */
export function mensagemCompartilhamento(sol: ResumoOportunidade, link: string): string {
  const partes = [tituloOportunidade(sol)];
  if (sol.cidade) partes.push(`📍 ${sol.cidade}`);
  const prazo = infoPrazo(sol.prazo_final);
  if (prazo && !prazo.encerrado) partes.push(`🗓️ Inscrições até ${prazo.data}`);
  partes.push(`\nVeja os detalhes e manifeste interesse: ${link}`);
  return partes.join("\n");
}
