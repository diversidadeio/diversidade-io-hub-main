/**
 * Utilitário para extrair o Quadro Societário de um PDF da JUCESP.
 * Usa pdfjs-dist carregado via CDN para funcionar no browser sem build extra.
 * 
 * Suporta:
 * - Ficha Cadastral Simplificada (formato "TITULAR / SÓCIOS / DIRETORIA")
 * - Ficha Cadastral Atualizada (tabela com colunas)
 */

export interface SocioExtraido {
  nome: string;
  cpfCnpj: string;
  valorParticipacao: string;
  percentualParticipacao: string;
  /** Raça/cor normalizada para o valor do formulário (ex: "Preto", "Pardo"). Pode ser string vazia se não encontrado. */
  racaCor: string;
}

// URL do worker do pdfjs-dist (CDN)
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

/**
 * Carrega o pdfjs-dist dinamicamente via CDN (apenas uma vez)
 */
async function carregarPdfJs(): Promise<any> {
  if ((window as any).__pdfjsLib) return (window as any).__pdfjsLib;
  const pdfjsLib = await import(/* @vite-ignore */ PDFJS_CDN);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
  (window as any).__pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

/**
 * Extrai todo o texto de todas as páginas do PDF
 */
async function extrairTextoPdf(arquivo: File): Promise<string> {
  const pdfjsLib = await carregarPdfJs();
  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let textoTotal = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    const textoDaPagina = conteudo.items
      .map((item: any) => item.str)
      .join(' ');
    textoTotal += textoDaPagina + '\n';
  }

  return textoTotal;
}

/**
 * Verifica se o documento é da Junta Comercial
 */
function ehDocumentoJucesp(texto: string): boolean {
  const t = texto.toUpperCase();
  return (
    t.includes('JUNTA COMERCIAL') ||
    t.includes('JUCESP') ||
    t.includes('JUCEMG') ||
    t.includes('JUCERJ') ||
    t.includes('FICHA CADASTRAL') ||
    t.includes('QUADRO SOCIETARIO') ||
    t.includes('QUADRO SOCIETÁRIO') ||
    t.includes('TITULAR / SÓCIOS') ||
    t.includes('TITULAR/SOCIOS') ||
    (t.includes('NIRE') && t.includes('PARTICIPAÇÃO NA SOCIEDADE'))
  );
}

/**
 * Normaliza o valor de RAÇA/COR extraído da JUCESP para o padrão do formulário.
 * Ex: "PRETA" → "Preto", "NÃO DECLARADA" → "" (campo vazio, usuário decide)
 */
function normalizarRacaCor(valorBruto: string): string {
  const v = valorBruto.toUpperCase().trim();
  if (v.includes('PRET')) return 'Preto';
  if (v.includes('PARD')) return 'Pardo';
  if (v.includes('BRANC')) return 'Branco';
  if (v.includes('AMAR')) return 'Amarelo';
  if (v.includes('IND')) return 'Indígena';
  // "NÃO DECLARADA", "NAO DECLARADA" ou valores desconhecidos → não preenche
  return '';
}

/**
 * Converte string monetária "51.000,00" para número
 */
function parseMoeda(valor: string): number {
  return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Formata número como moeda brasileira "51.000,00"
 */
function formatarMoeda(n: number): string {
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata percentual com 2 casas decimais "51,00"
 */
function formatarPercentual(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/**
 * Extrai capital total da seção CAPITAL do documento
 * Exemplo: "R$ 100.000,00 (CEM MIL REAIS)"
 */
function extrairCapitalTotal(texto: string): number {
  // Procura por "CAPITAL" seguido de valor monetário (com ou sem R$)
  const matchCapital = texto.match(/CAPITAL[\s\S]{0,200}?R?\$\s*([\d.,]+)/i);
  if (matchCapital) {
    return parseMoeda(matchCapital[1]);
  }
  return 0;
}

/**
 * PADRÃO 1: Ficha Cadastral Simplificada da JUCESP
 * 
 * Formato: 
 * TITULAR / SÓCIOS / DIRETORIA
 * NOME COMPLETO, RAÇA/COR: ..., NACIONALIDADE ..., CPF: xxx.xxx.xxx-xx, RG/RNE: ...
 * OCUPANDO O CARGO DE SÓCIO..., COM VALOR DE PARTICIPAÇÃO NA SOCIEDADE DE $ xx.xxx,xx.
 */
function extrairFichaCadastralSimplificada(texto: string, capitalTotal: number): SocioExtraido[] {
  const socios: SocioExtraido[] = [];

  // Localiza seção de sócios
  const secaoMatch = texto.match(
    /TITULAR\s*[/\/]\s*S[ÓO]CIOS\s*[/\/]\s*DIRETORIA([\s\S]*?)(?=5\s+[ÚU]LTIMOS\s+ARQUIVAMENTOS|FIM\s+DAS\s+INFORMA|$)/i
  );

  const secao = secaoMatch ? secaoMatch[1] : texto;

  // Cada sócio tem seu CPF e valor de participação
  // Regex principal: encontra o CPF e captura o contexto ao redor
  const regexSocio = /CPF:\s*([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/gi;
  let match;

  while ((match = regexSocio.exec(secao)) !== null) {
    const cpf = match[1];
    const posicaoCpf = match.index;

    // Nome: texto antes do CPF, até a última vírgula antes de "RAÇA" ou "NACIONALIDADE"
    const antesDocCpf = secao.substring(Math.max(0, posicaoCpf - 500), posicaoCpf);
    
    // O nome termina antes de ", RAÇA/COR:" ou ", NACIONALIDADE"
    const regexFimNome = /([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]{5,}?),\s*(?:RAÇ[AÃ]\/COR|NACIONALIDADE)/i;
    const nomeMatch = antesDocCpf.match(regexFimNome);
    
    // Pega a última ocorrência (mais perto do CPF)
    let nome = '';
    const todasOcurrencias = Array.from(antesDocCpf.matchAll(
      /([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]{5,}?),\s*(?:RAÇ[AÃ]\/COR|NACIONALIDADE)/gi
    ));
    if (todasOcurrencias.length > 0) {
      nome = todasOcurrencias[todasOcurrencias.length - 1][1].trim();
    }

    // Extrai RAÇA/COR do bloco que contém o sócio (antes do CPF)
    // Padrão: "RAÇA/COR: PRETA" ou "RACA/COR: PARDA"
    const racaMatch = antesDocCpf.match(/RAÇ[AÃ]\/COR\s*:\s*([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇÃ\s]+?)(?=\s*,|\s*$)/i);
    const racaCor = racaMatch ? normalizarRacaCor(racaMatch[1]) : '';

    // Valor de participação: após "VALOR DE PARTICIPAÇÃO NA SOCIEDADE DE $"
    const aposPosition = posicaoCpf + match[0].length;
    const depoisDoCpf = secao.substring(aposPosition, aposPosition + 600);
    
    const valorMatch = depoisDoCpf.match(
      /VALOR\s+DE\s+PARTICIPA[ÇC][ÃA]O\s+NA\s+SOCIEDADE\s+DE\s+\$\s*([\d.]+,[\d]{2})/i
    );

    if (!nome || nome.length < 3) continue;
    if (!valorMatch) continue;

    const valorNum = parseMoeda(valorMatch[1]);
    const percentual = capitalTotal > 0 ? (valorNum / capitalTotal) * 100 : 0;

    socios.push({
      nome,
      cpfCnpj: cpf,
      valorParticipacao: formatarMoeda(valorNum),
      percentualParticipacao: formatarPercentual(percentual),
      racaCor,
    });
  }

  return socios;
}

/**
 * PADRÃO 2: Tabela estruturada (Ficha Cadastral Atualizada / outros formatos)
 * Formato: Nome | CPF | Valor | %
 */
function extrairTabelaEstruturada(texto: string): SocioExtraido[] {
  const socios: SocioExtraido[] = [];

  // Regex para capturar nome + CPF + valor + percentual em linha única
  const regexLinha = /([A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ][A-ZÁÀÃÂÉÈÊÍÓÔÕÚÇ\s]{5,}?)\s+((?:\d{3}\.){2}\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+([\d.]+,\d{2})\s+([\d]+,[\d]{2,4})\s*%?/gi;

  let match;
  while ((match = regexLinha.exec(texto)) !== null) {
    const nome = match[1].trim();
    if (/NOME|SOCIO|SÓCIO|QUADRO|PARTICIP/i.test(nome)) continue;
    if (nome.split(/\s+/).length < 2) continue;

    socios.push({
      nome,
      cpfCnpj: match[2],
      valorParticipacao: match[3],
      percentualParticipacao: match[4],
      racaCor: '', // Tabela estruturada não contém campo raça/cor
    });
  }

  return socios;
}

/**
 * Função principal: recebe um File PDF e retorna os sócios encontrados.
 * Se o documento não for da Junta Comercial, retorna array vazio (sem erro).
 */
export async function extrairSociosDoJucesp(arquivo: File): Promise<SocioExtraido[]> {
  try {
    const texto = await extrairTextoPdf(arquivo);

    // Verificação silenciosa: se não for da Junta Comercial, não faz nada
    if (!ehDocumentoJucesp(texto)) {
      console.info('[extrairJucesp] Documento não identificado como Ficha Cadastral. Ignorando.');
      return [];
    }

    const capitalTotal = extrairCapitalTotal(texto);
    console.info(`[extrairJucesp] Capital total encontrado: R$ ${capitalTotal}`);

    // Tenta padrão 1: Ficha Cadastral Simplificada
    let socios = extrairFichaCadastralSimplificada(texto, capitalTotal);

    // Se não encontrou, tenta padrão 2: tabela estruturada
    if (socios.length === 0) {
      socios = extrairTabelaEstruturada(texto);
    }

    console.info(`[extrairJucesp] ${socios.length} sócio(s) encontrado(s):`, socios);
    return socios;

  } catch (erro) {
    // Falha silenciosa — o formulário continua funcionando normalmente
    console.warn('[extrairJucesp] Erro ao processar PDF:', erro);
    return [];
  }
}
