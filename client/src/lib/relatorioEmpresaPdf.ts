/**
 * Relatório de Auditoria por Empresa, em PDF.
 *
 * Os dados chegam prontos de `/api/relatorio-empresa` (agregação em
 * `api/_relatorio.ts`); aqui só existe desenho. A geração é no navegador de
 * propósito: renderizar PDF no servidor exigiria um Chromium headless, que não
 * cabe no plano da Vercel, e o relatório é sempre disparado por um clique.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// `?inline` entrega a logo como data URI: o jsPDF a embute direto, sem
// depender do `Image` do navegador — que nao existe quando os testes montam
// o documento no Node.
import logoDataUri from "@/assets/logo.png?inline";
import {
  formatarDataBrasilia,
  formatarDataHoraBrasilia,
  formatarNumero,
  rotuloStatusAprovacao,
  rotuloStatusSolicitacao,
  type CorRgb,
} from "./relatorioFormato";

// ── Identidade visual ───────────────────────────────────────────────────────
const ROXO: CorRgb = [112, 48, 160]; // #7030A0, o mesmo do --primary
const ROXO_SUAVE: CorRgb = [244, 238, 250];
const TINTA: CorRgb = [26, 22, 34];
const TINTA_SUAVE: CorRgb = [112, 116, 128];
const LINHA: CorRgb = [228, 226, 233];
const ZEBRA: CorRgb = [250, 249, 252];
const VERDE: CorRgb = [22, 137, 88];
const CINZA: CorRgb = [120, 124, 136];

// A4 em pontos.
const LARGURA_PAGINA = 595.28;
const ALTURA_PAGINA = 841.89;
const MARGEM = 42;
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2;
/** Piso do conteúdo: abaixo disso começa a área reservada ao rodapé. */
const PISO_CONTEUDO = ALTURA_PAGINA - 62;
/** Topo do conteúdo nas páginas de continuação, abaixo do cabeçalho corrido. */
const TOPO_CONTINUACAO = 78;

export type UsuarioRelatorio = {
  nome: string;
  email: string;
  papel: string;
  ultimoAcesso: string | null;
  totalLogins: number;
  totalFalhas: number;
  totalAcoes: number;
  totalSolicitacoes: number;
  ativo: boolean;
};

export type DadosRelatorio = {
  empresa: Record<string, any>;
  periodo: { chave: string; inicio: string | null; fim: string };
  resumo: {
    totalUsuarios: number;
    usuariosAtivos: number;
    usuariosSemAcesso: number;
    totalAcessos: number;
    totalFalhas: number;
    ultimoAcesso: string | null;
    totalSolicitacoes: number;
    solicitacoesPorStatus: Record<string, number>;
  };
  usuarios: UsuarioRelatorio[];
  serieAcessos: { rotulo: string; total: number }[];
  solicitacoes: {
    criadoEm: string | null;
    cnaes: string;
    cidade: string;
    modalidade: string;
    status: string;
    autorNome: string;
    autorEmail: string;
  }[];
  eventos: { criado_em: string; email: string; tipo_evento: string; detalhes: string | null }[];
  acoesAdm: {
    criado_em: string;
    tipo_evento: string;
    detalhes: string | null;
    executor_adm_email: string | null;
  }[];
  totalEventos: number;
  eventosTruncados: boolean;
};

export type OpcoesRelatorio = {
  /** Converte `tipo_evento` no rótulo que a tela de Logs já exibe. */
  rotularEvento: (tipo: string) => string;
};

const ROTULOS_PERIODO: Record<string, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "12m": "Últimos 12 meses",
  tudo: "Todo o histórico",
};

/** Topo "redondo" do eixo (1, 2, 2,5, 5 ou 10 vezes a potência de dez). */
function escalaSuperior(maximo: number): number {
  if (maximo <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const passo of [1, 2, 2.5, 5, 10]) {
    const candidato = passo * potencia;
    if (candidato >= maximo) return candidato;
  }
  return 10 * potencia;
}

function limparNomeArquivo(texto: string): string {
  return texto
    .normalize("NFD")
    .split("").filter((letra) => letra.charCodeAt(0) < 128).join("")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/**
 * Monta o documento e devolve o jsPDF, sem salvar.
 *
 * Separado de `gerarRelatorioEmpresaPdf` para que os testes possam montar o
 * relatorio inteiro e inspecionar o resultado sem disparar um download.
 */
export async function montarDocumentoRelatorio(
  dados: DadosRelatorio,
  opcoes: OpcoesRelatorio,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  const empresa = dados.empresa || {};
  const nomeEmpresa = empresa.razao_social || empresa.nome_fantasia || "Empresa";
  const emitidoEm = new Date().toISOString();

  doc.setProperties({
    title: `Relatório de Auditoria — ${nomeEmpresa}`,
    subject: "Trilha de acessos e ações na plataforma Diversidade.io",
    author: "Diversidade.io",
    creator: "Diversidade.io",
  });

  let y = MARGEM;

  const definirCor = (cor: CorRgb) => doc.setTextColor(cor[0], cor[1], cor[2]);
  const preencher = (cor: CorRgb) => doc.setFillColor(cor[0], cor[1], cor[2]);
  const tracar = (cor: CorRgb) => doc.setDrawColor(cor[0], cor[1], cor[2]);

  /** Abre página nova quando o bloco que vem a seguir não cabe mais. */
  const garantirEspaco = (altura: number) => {
    if (y + altura <= PISO_CONTEUDO) return;
    doc.addPage();
    y = TOPO_CONTINUACAO;
  };

  const tituloSecao = (texto: string) => {
    garantirEspaco(46);
    y += 6;
    preencher(ROXO);
    doc.rect(MARGEM, y - 7, 3, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setCharSpace(0.8);
    definirCor(ROXO);
    doc.text(texto.toUpperCase(), MARGEM + 10, y + 1);
    doc.setCharSpace(0);
    y += 10;
    tracar(LINHA);
    doc.setLineWidth(0.5);
    doc.line(MARGEM, y, LARGURA_PAGINA - MARGEM, y);
    y += 16;
  };

  // ── Cabeçalho da primeira página ──────────────────────────────────────────
  preencher(ROXO);
  doc.rect(0, 0, LARGURA_PAGINA, 5, "F");
  y = MARGEM + 14;

  // O arquivo de logo e so o simbolo: o nome vem ao lado, formando a assinatura
  // da marca. Se a imagem falhar, sobra o nome — que ja identifica o emissor.
  let deslocamentoDaMarca = 0;
  try {
    const proporcoes = doc.getImageProperties(logoDataUri);
    const alturaSimbolo = 26;
    const larguraSimbolo = (proporcoes.width / proporcoes.height) * alturaSimbolo;
    doc.addImage(logoDataUri, "PNG", MARGEM, y - 19, larguraSimbolo, alturaSimbolo);
    deslocamentoDaMarca = larguraSimbolo + 7;
  } catch {
    deslocamentoDaMarca = 0;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  definirCor(ROXO);
  doc.text("diversidade.io", MARGEM + deslocamentoDaMarca, y - 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setCharSpace(1.4);
  definirCor(TINTA_SUAVE);
  doc.text("RELATÓRIO DE AUDITORIA", LARGURA_PAGINA - MARGEM, y - 4, { align: "right" });
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Emitido em ${formatarDataHoraBrasilia(emitidoEm)}`,
    LARGURA_PAGINA - MARGEM,
    y + 7,
    { align: "right" },
  );

  y += 34;

  // ── Identificação da empresa ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  definirCor(TINTA);
  const linhasTitulo = doc.splitTextToSize(nomeEmpresa, LARGURA_UTIL);
  doc.text(linhasTitulo, MARGEM, y);
  y += linhasTitulo.length * 22;

  const subtitulo = [empresa.nome_fantasia, empresa.cnpj ? `CNPJ ${empresa.cnpj}` : null]
    .filter(Boolean)
    .join("   •   ");
  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    definirCor(TINTA_SUAVE);
    doc.text(subtitulo, MARGEM, y);
    y += 18;
  }

  // Faixa do período analisado.
  const rotuloPeriodo = ROTULOS_PERIODO[dados.periodo.chave] || "Período personalizado";
  const intervalo = dados.periodo.inicio
    ? `${formatarDataBrasilia(dados.periodo.inicio)} a ${formatarDataBrasilia(dados.periodo.fim)}`
    : `até ${formatarDataBrasilia(dados.periodo.fim)}`;
  preencher(ROXO_SUAVE);
  doc.roundedRect(MARGEM, y - 2, LARGURA_UTIL, 24, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  definirCor(ROXO);
  doc.text(`Período analisado: ${rotuloPeriodo}`, MARGEM + 10, y + 13);
  doc.setFont("helvetica", "normal");
  definirCor(TINTA_SUAVE);
  doc.text(intervalo, LARGURA_PAGINA - MARGEM - 10, y + 13, { align: "right" });
  y += 38;

  // Ficha cadastral em duas colunas.
  const statusCadastro = rotuloStatusAprovacao(empresa.status_aprovacao);
  const fichaCadastral: [string, string][] = [
    ["Responsável pelo cadastro", empresa.nome_responsavel || "—"],
    ["E-mail do cadastro", empresa.email || "—"],
    ["Telefone", empresa.telefone_principal || "—"],
    ["Situação do CNPJ", empresa.situacao_cnpj || "Não verificada"],
    ["Área de atuação", empresa.area_empresa || "—"],
    ["Abrangência", empresa.area_geografica || "—"],
    ["Cadastro desde", formatarDataBrasilia(empresa.created_at)],
    ["Status do cadastro", statusCadastro.texto],
  ];

  const larguraColuna = LARGURA_UTIL / 2;
  fichaCadastral.forEach(([rotulo, valor], indice) => {
    const coluna = indice % 2;
    const linha = Math.floor(indice / 2);
    const x = MARGEM + coluna * larguraColuna;
    const topo = y + linha * 30;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    definirCor(TINTA_SUAVE);
    doc.text(rotulo.toUpperCase(), x, topo);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    // O status do cadastro é a única linha da ficha que carrega cor, porque é
    // a única que representa um estado; o texto ao lado dela mantém a cor de
    // tinta, então a informação nunca depende só da cor.
    definirCor(rotulo === "Status do cadastro" ? statusCadastro.cor : TINTA);
    doc.text(doc.splitTextToSize(String(valor), larguraColuna - 16)[0], x, topo + 12);
  });
  y += Math.ceil(fichaCadastral.length / 2) * 30 + 6;

  // ── Resumo executivo ──────────────────────────────────────────────────────
  tituloSecao("Resumo executivo");

  const cartoes: { rotulo: string; valor: string; nota: string; cor: CorRgb }[] = [
    {
      rotulo: "Acessos no período",
      valor: formatarNumero(dados.resumo.totalAcessos),
      nota: `${formatarNumero(dados.resumo.totalFalhas)} tentativa(s) falha(s)`,
      cor: ROXO,
    },
    {
      rotulo: "Usuários que acessaram",
      valor: `${dados.resumo.usuariosAtivos} de ${dados.resumo.totalUsuarios}`,
      nota: "vinculados à empresa",
      cor: VERDE,
    },
    {
      rotulo: "Nunca acessaram",
      valor: formatarNumero(dados.resumo.usuariosSemAcesso),
      nota: "usuário(s) sem login",
      cor: CINZA,
    },
    {
      rotulo: "Solicitações de busca",
      valor: formatarNumero(dados.resumo.totalSolicitacoes),
      nota: "abertas na plataforma",
      cor: ROXO,
    },
  ];

  garantirEspaco(74);
  const larguraCartao = (LARGURA_UTIL - 3 * 10) / 4;
  cartoes.forEach((cartao, indice) => {
    const x = MARGEM + indice * (larguraCartao + 10);
    preencher(ZEBRA);
    tracar(LINHA);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, larguraCartao, 62, 5, 5, "FD");
    preencher(cartao.cor);
    doc.rect(x, y + 10, 2.5, 16, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    definirCor(TINTA_SUAVE);
    doc.text(doc.splitTextToSize(cartao.rotulo.toUpperCase(), larguraCartao - 20), x + 10, y + 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    definirCor(TINTA);
    doc.text(cartao.valor, x + 10, y + 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    definirCor(TINTA_SUAVE);
    doc.text(doc.splitTextToSize(cartao.nota, larguraCartao - 20)[0], x + 10, y + 54);
  });
  y += 78;

  // Último acesso registrado, em destaque: é a pergunta que a empresa faz.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  definirCor(TINTA_SUAVE);
  doc.text("Último acesso registrado no período:", MARGEM, y);
  doc.setFont("helvetica", "bold");
  definirCor(dados.resumo.ultimoAcesso ? TINTA : CINZA);
  doc.text(
    dados.resumo.ultimoAcesso
      ? formatarDataHoraBrasilia(dados.resumo.ultimoAcesso)
      : "Nenhum acesso no período",
    MARGEM + doc.getTextWidth("Último acesso registrado no período: ") + 4,
    y,
  );
  y += 22;

  // ── Gráfico de acessos ────────────────────────────────────────────────────
  desenharGraficoAcessos();

  function desenharGraficoAcessos() {
    const serie = dados.serieAcessos || [];
    const alturaPlano = 104;
    garantirEspaco(alturaPlano + 46);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    definirCor(TINTA);
    doc.text("Acessos ao longo do período", MARGEM, y);
    y += 14;

    const base = y + alturaPlano;
    const maximo = Math.max(0, ...serie.map((p) => p.total));

    if (serie.length === 0 || maximo === 0) {
      preencher(ZEBRA);
      tracar(LINHA);
      doc.setLineWidth(0.5);
      doc.roundedRect(MARGEM, y, LARGURA_UTIL, alturaPlano, 5, 5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      definirCor(TINTA_SUAVE);
      doc.text(
        "Nenhum acesso registrado no período.",
        MARGEM + LARGURA_UTIL / 2,
        y + alturaPlano / 2 + 3,
        { align: "center" },
      );
      y = base + 26;
      return;
    }

    const topo = escalaSuperior(maximo);
    const larguraEixo = 26;
    const x0 = MARGEM + larguraEixo;
    const larguraPlano = LARGURA_UTIL - larguraEixo;

    // Grade recessiva: três referências bastam para ler as alturas.
    doc.setLineWidth(0.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    for (const fracao of [0, 0.5, 1]) {
      const valor = topo * fracao;
      const linhaY = base - alturaPlano * fracao;
      tracar(fracao === 0 ? LINHA : [240, 239, 243]);
      doc.line(x0, linhaY, x0 + larguraPlano, linhaY);
      // Um "3" no meio de uma escala que vai ate 5 se le como erro de conta:
      // a referencia do meio so ganha rotulo quando cai em numero inteiro.
      if (Number.isInteger(valor)) {
        definirCor(TINTA_SUAVE);
        doc.text(formatarNumero(valor), x0 - 6, linhaY + 2, { align: "right" });
      }
    }

    const vao = larguraPlano / serie.length;
    const espessura = Math.max(2, Math.min(22, vao - 2)); // 2pt de respiro entre barras
    const indiceMaximo = serie.findIndex((p) => p.total === maximo);

    serie.forEach((ponto, indice) => {
      if (ponto.total <= 0) return;
      const altura = (ponto.total / topo) * alturaPlano;
      const x = x0 + indice * vao + (vao - espessura) / 2;
      preencher(ROXO);
      const raio = Math.min(2, espessura / 2);
      // Ponta arredondada em cima, quadrada na linha de base.
      doc.roundedRect(x, base - altura, espessura, altura, raio, raio, "F");
      if (altura > raio) doc.rect(x, base - raio, espessura, raio, "F");
    });

    // Rótulo direto só no extremo — um número por barra vira ruído.
    if (indiceMaximo >= 0) {
      const altura = (maximo / topo) * alturaPlano;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      definirCor(TINTA);
      doc.text(
        formatarNumero(maximo),
        x0 + indiceMaximo * vao + vao / 2,
        base - altura - 4,
        { align: "center" },
      );
    }

    // Rótulos do eixo x com espaçamento suficiente para não colidirem.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    definirCor(TINTA_SUAVE);
    const larguraRotulo = Math.max(...serie.map((p) => doc.getTextWidth(p.rotulo)));
    const passo = Math.max(1, Math.ceil((larguraRotulo + 8) / vao));
    serie.forEach((ponto, indice) => {
      if (indice % passo !== 0 && indice !== serie.length - 1) return;
      if (indice === serie.length - 1 && (serie.length - 1) % passo !== 0 && passo > 1) {
        // Evita que o último rótulo encoste no anterior que já foi desenhado.
        const ultimoDesenhado = Math.floor((serie.length - 1) / passo) * passo;
        if (serie.length - 1 - ultimoDesenhado < passo / 2) return;
      }
      doc.text(ponto.rotulo, x0 + indice * vao + vao / 2, base + 12, { align: "center" });
    });

    y = base + 26;
  }

  // ── Usuários vinculados ───────────────────────────────────────────────────
  tituloSecao("Usuários vinculados à empresa");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  definirCor(TINTA_SUAVE);
  const notaUsuarios = doc.splitTextToSize(
    "Cada linha corresponde a um usuário com acesso à plataforma em nome da empresa: " +
      "o responsável pelo cadastro e os convidados. “Sem acesso” significa nenhum login " +
      "bem-sucedido dentro do período analisado.",
    LARGURA_UTIL,
  );
  doc.text(notaUsuarios, MARGEM, y);
  y += notaUsuarios.length * 10 + 8;

  const coresLinhaUsuario = dados.usuarios.map((u) => (u.ativo ? VERDE : CINZA));
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM, right: MARGEM, bottom: 62, top: TOPO_CONTINUACAO },
    head: [["Usuário", "Papel", "Último acesso", "Acessos", "Falhas", "Solicit.", "Situação"]],
    body: dados.usuarios.map((usuario) => [
      `${usuario.nome}\n${usuario.email}`,
      usuario.papel === "responsavel" ? "Responsável" : usuario.papel === "admin" ? "Administrador" : "Usuário",
      formatarDataHoraBrasilia(usuario.ultimoAcesso),
      formatarNumero(usuario.totalLogins),
      formatarNumero(usuario.totalFalhas),
      formatarNumero(usuario.totalSolicitacoes),
      usuario.ativo ? "Acessou" : "Sem acesso",
    ]),
    ...estiloTabela(),
    columnStyles: {
      1: { cellWidth: 62 },
      2: { cellWidth: 84 },
      3: { cellWidth: 42, halign: "right" },
      4: { cellWidth: 40, halign: "right" },
      5: { cellWidth: 42, halign: "right" },
      6: { cellWidth: 66, fontStyle: "bold" },
    },
    didParseCell: (data: any) => {
      if (data.section !== "body") return;
      if (data.column.index === 6) {
        data.cell.styles.textColor = coresLinhaUsuario[data.row.index];
      }
      if (data.column.index === 0) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Solicitações de busca ─────────────────────────────────────────────────
  tituloSecao("Solicitações de busca abertas");

  if (dados.solicitacoes.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    definirCor(TINTA_SUAVE);
    doc.text("Nenhuma solicitação de busca foi aberta no período analisado.", MARGEM, y);
    y += 20;
  } else {
    const resumoStatus = Object.entries(dados.resumo.solicitacoesPorStatus)
      .map(([status, quantidade]) => `${rotuloStatusSolicitacao(status).texto}: ${quantidade}`)
      .join("   •   ");
    if (resumoStatus) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      definirCor(TINTA_SUAVE);
      doc.text(resumoStatus, MARGEM, y);
      y += 16;
    }

    const coresStatus = dados.solicitacoes.map((s) => rotuloStatusSolicitacao(s.status).cor);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM, bottom: 62, top: TOPO_CONTINUACAO },
      head: [["Aberta em", "Solicitante", "Cidade", "Modalidade", "CNAEs", "Status"]],
      body: dados.solicitacoes.map((solicitacao) => [
        formatarDataHoraBrasilia(solicitacao.criadoEm),
        solicitacao.autorNome === "—" && solicitacao.autorEmail === "—"
          ? "Não identificado"
          : `${solicitacao.autorNome}\n${solicitacao.autorEmail}`,
        solicitacao.cidade,
        solicitacao.modalidade,
        solicitacao.cnaes,
        rotuloStatusSolicitacao(solicitacao.status).texto,
      ]),
      ...estiloTabela(),
      columnStyles: {
        0: { cellWidth: 78 },
        1: { cellWidth: 128 },
        2: { cellWidth: 66 },
        3: { cellWidth: 58 },
        5: { cellWidth: 74, fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 5) {
          data.cell.styles.textColor = coresStatus[data.row.index];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Ações de administradores sobre a empresa ──────────────────────────────
  if (dados.acoesAdm.length > 0) {
    tituloSecao("Ações da administração sobre o cadastro");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM, bottom: 62, top: TOPO_CONTINUACAO },
      head: [["Data e hora", "Ação", "Administrador", "Detalhes"]],
      body: dados.acoesAdm.map((acao) => [
        formatarDataHoraBrasilia(acao.criado_em),
        opcoes.rotularEvento(acao.tipo_evento),
        acao.executor_adm_email || "—",
        acao.detalhes || "—",
      ]),
      ...estiloTabela(),
      columnStyles: {
        0: { cellWidth: 84 },
        1: { cellWidth: 108 },
        2: { cellWidth: 128 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Apêndice: histórico de eventos ────────────────────────────────────────
  tituloSecao("Apêndice — histórico de eventos");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  definirCor(TINTA_SUAVE);
  const notaApendice = dados.eventosTruncados
    ? `Foram registrados ${formatarNumero(dados.totalEventos)} eventos no período. ` +
      `Este apêndice lista os ${formatarNumero(dados.eventos.length)} mais recentes.`
    : `${formatarNumero(dados.totalEventos)} evento(s) registrado(s) no período.`;
  doc.text(doc.splitTextToSize(notaApendice, LARGURA_UTIL), MARGEM, y);
  y += 18;

  if (dados.eventos.length === 0) {
    doc.setFontSize(9);
    doc.text("Nenhum evento registrado no período analisado.", MARGEM, y);
    y += 16;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEM, right: MARGEM, bottom: 62, top: TOPO_CONTINUACAO },
      head: [["Data e hora", "Usuário", "Ação", "Detalhes"]],
      body: dados.eventos.map((evento) => [
        formatarDataHoraBrasilia(evento.criado_em),
        evento.email,
        opcoes.rotularEvento(evento.tipo_evento),
        evento.detalhes || "—",
      ]),
      ...estiloTabela(),
      columnStyles: {
        0: { cellWidth: 84 },
        1: { cellWidth: 148 },
        2: { cellWidth: 96 },
      },
    });
  }

  // ── Cabeçalho de continuação e rodapé, em todas as páginas ────────────────
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);

    if (pagina > 1) {
      preencher(ROXO);
      doc.rect(0, 0, LARGURA_PAGINA, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setCharSpace(0.6);
      definirCor(TINTA_SUAVE);
      doc.text("RELATÓRIO DE AUDITORIA", MARGEM, 40);
      doc.setCharSpace(0);
      doc.setFont("helvetica", "normal");
      doc.text(
        doc.splitTextToSize(nomeEmpresa, LARGURA_UTIL / 2)[0],
        LARGURA_PAGINA - MARGEM,
        40,
        { align: "right" },
      );
      tracar(LINHA);
      doc.setLineWidth(0.5);
      doc.line(MARGEM, 50, LARGURA_PAGINA - MARGEM, 50);
    }

    tracar(LINHA);
    doc.setLineWidth(0.5);
    doc.line(MARGEM, ALTURA_PAGINA - 46, LARGURA_PAGINA - MARGEM, ALTURA_PAGINA - 46);

    preencher(ROXO);
    doc.rect(MARGEM, ALTURA_PAGINA - 36, 2.5, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    definirCor(ROXO);
    doc.text("Diversidade.io", MARGEM + 8, ALTURA_PAGINA - 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    definirCor(TINTA_SUAVE);
    doc.text(
      "Documento confidencial — trilha de auditoria para conformidade com a LGPD.",
      MARGEM + 8,
      ALTURA_PAGINA - 21,
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    definirCor(TINTA);
    doc.text(`Página ${pagina} de ${totalPaginas}`, LARGURA_PAGINA - MARGEM, ALTURA_PAGINA - 30, {
      align: "right",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    definirCor(TINTA_SUAVE);
    doc.text(
      `Emitido em ${formatarDataHoraBrasilia(emitidoEm)}`,
      LARGURA_PAGINA - MARGEM,
      ALTURA_PAGINA - 21,
      { align: "right" },
    );
  }

  return doc;
}

/** Monta o relatorio e dispara o download no navegador. */
export async function gerarRelatorioEmpresaPdf(
  dados: DadosRelatorio,
  opcoes: OpcoesRelatorio,
): Promise<void> {
  const doc = await montarDocumentoRelatorio(dados, opcoes);
  const nomeEmpresa = dados.empresa?.razao_social || dados.empresa?.nome_fantasia || "Empresa";
  const dataArquivo = formatarDataBrasilia(new Date().toISOString()).split("/").reverse().join("-");
  doc.save(`relatorio-auditoria-${limparNomeArquivo(nomeEmpresa)}-${dataArquivo}.pdf`);
}

/** Estilo comum das tabelas — grade discreta, cabeçalho na cor da marca. */
function estiloTabela() {
  return {
    theme: "grid" as const,
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
      lineColor: LINHA,
      lineWidth: 0.4,
      textColor: TINTA,
      overflow: "linebreak" as const,
      valign: "middle" as const,
    },
    headStyles: {
      fillColor: ROXO,
      textColor: [255, 255, 255] as CorRgb,
      fontStyle: "bold" as const,
      fontSize: 7.5,
      lineColor: ROXO,
    },
    alternateRowStyles: { fillColor: ZEBRA },
  };
}
