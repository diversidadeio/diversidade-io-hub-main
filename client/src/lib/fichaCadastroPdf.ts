import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoDataUri from "@/assets/logo.png?inline";
import { formatarDataHoraBrasilia, rotuloStatusAprovacao } from "./relatorioFormato";

type Registro = Record<string, any>;
type Campo = [string, string];

const texto = (valor: unknown): string => {
  if (valor == null || valor === "") return "Não informado";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.length ? valor.map(texto).join(", ") : "Não informado";
  return String(valor);
};

/** Usa somente os dados do cadastro exibidos ao administrador. */
export function montarFichaCadastroPdf(empresa: Registro, socios: Registro[], ceps: Registro[]): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 16;
  let y = 38;
  const nome = texto(empresa.razao_social || empresa.nome_fantasia);
  doc.setProperties({ title: `Ficha de cadastro - ${nome}`, author: "Diversidade.io" });
  doc.setFillColor(112, 48, 160);
  doc.rect(0, 0, 210, 1.76, "F");
  let deslocamentoDaMarca = 0;
  try {
    const proporcoes = doc.getImageProperties(logoDataUri);
    const alturaSimbolo = 26 * 25.4 / 72;
    const larguraSimbolo = proporcoes.width / proporcoes.height * alturaSimbolo;
    doc.addImage(logoDataUri, "PNG", margem, 13.3, larguraSimbolo, alturaSimbolo);
    deslocamentoDaMarca = larguraSimbolo + 7 * 25.4 / 72;
  } catch {
    // Mantém o nome da marca se a imagem não estiver disponível.
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(112, 48, 160);
  doc.text("diversidade.io", margem + deslocamentoDaMarca, 19.6);
  doc.setFontSize(8);
  doc.setCharSpace(1.4 * 25.4 / 72);
  doc.setTextColor(75, 85, 99);
  doc.text("FICHA DE CADASTRO", 194, 18.6, { align: "right" });
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Emitida em ${formatarDataHoraBrasilia(new Date().toISOString())}`, 194, 22.4, { align: "right" });

  const secao = (titulo: string, linhas: string[][]) => {
    // Reserva espaço para o título e a primeira linha da tabela.
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(112, 48, 160);
    doc.text(titulo, margem, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Campo", "Informação"]],
      body: linhas,
      theme: "striped",
      margin: { left: margem, right: margem, top: 20, bottom: 20 },
      styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak", textColor: [31, 41, 55] },
      headStyles: { fillColor: [112, 48, 160], textColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 123 } },
      rowPageBreak: "avoid",
      didDrawCell: ({ section, column, cell }) => {
        const url = cell.text.join("");
        if (section === "body" && column.index === 1 && /^https?:\/\//i.test(url)) {
          doc.link(cell.x, cell.y, cell.width, cell.height, { url });
        }
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };
  const campos = (dados: Registro, lista: Campo[]) => lista.map(([rotulo, chave]) => [rotulo, texto(dados[chave])]);

  secao("Identificação do cadastro", [
    ["Empresa", nome],
    ["Status", rotuloStatusAprovacao(empresa.status_aprovacao).texto],
    ["Código do cadastro", texto(empresa.id)],
  ]);
  secao("Informações do Responsável", campos(empresa, [
    ["Nome do Responsável", "nome_responsavel"], ["E-mail (Login)", "email"],
    ["Telefone Principal", "telefone_principal"], ["Telefone Opcional", "telefone_opcional"],
    ["Foto do Responsável (anexo)", "foto_responsavel_url"],
  ]));
  secao("Dados da Empresa", campos(empresa, [
    ["Razão Social", "razao_social"], ["Nome Fantasia", "nome_fantasia"], ["CNPJ", "cnpj"],
    ["Situação do CNPJ", "situacao_cnpj"],
    ["Tipo de Acesso", "acesso_tipo"], ["Área de Atuação", "area_empresa"],
    ["CNAEs", "atividade_empresarial"], ["Área Geográfica", "area_geografica"],
    ["Logo da Empresa (anexo)", "logo_empresa_url"], ["Cartão CNPJ (anexo)", "cartao_cnpj_url"],
    ["Ficha da Junta Comercial (anexo)", "ficha_junta_url"], ["Sobre a Empresa", "sobre_empresa"],
  ]).concat([["CNPJ verificado em", empresa.situacao_cnpj_verificado_em ? formatarDataHoraBrasilia(empresa.situacao_cnpj_verificado_em) : "Não verificado"]]));
  secao("Dados Financeiros", campos(empresa, [
    ["Emite Nota Fiscal?", "emite_nota_fiscal"], ["Possui Conta PJ?", "tem_conta_pj"],
    ["Formas de Pagamento (Paga)", "formas_pagamento"], ["Formas de Recebimento", "formas_recebimento"],
  ]));
  if (!socios.length) secao("Quadro Societário", [["Sócios", "Nenhum sócio cadastrado."]]);
  socios.forEach((socio, indice) => {
    const linhas = campos(socio, [
      ["Nome", "nome"], ["CPF", "cpf"], ["E-mail", "email"], ["CEP", "cep"],
      ["Endereço", "cep_endereco"], ["Nacionalidade", "nacionalidade"], ["Raça", "raca"],
      ["Participação %", "participacao_percentual"],
    ]);
    const nascimento = socio.data_nascimento;
    linhas.push(["Data de Nascimento", typeof nascimento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(nascimento)
      ? nascimento.split("-").reverse().join("/") : texto(nascimento)]);
    linhas.push(["Participação R$", socio.participacao_valor != null && socio.participacao_valor !== "" && Number.isFinite(Number(socio.participacao_valor))
      ? Number(socio.participacao_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : texto(socio.participacao_valor)]);
    secao(`Quadro Societário - Sócio ${indice + 1}`, linhas);
  });
  secao("Dados do Impacto Social", campos(empresa, [
    ["É Empreendedor(a)?", "e_socio"], ["Tem Sócios Negros?", "tem_negros_socios"],
    ["Autoriza Compartilhamento?", "autoriza_compartilhamento"],
  ]));
  const grupos = [
    ["GESTOR_DIRETO", "Localização dos Gestores"],
    ["COLABORADOR_DIRETO", "Localização dos Colaboradores"],
    ["GESTOR", "Impactados pelo Gestor"], ["SOCIO", "Impactados pelo Sócio"],
    ["COLABORADOR", "Impactados pelo Colaborador"],
  ];
  const locaisSocios = socios.filter(s => s.cep).map(s => [texto(s.cep), texto(s.cep_endereco)]);
  secao("Localização dos Sócios", locaisSocios.length ? locaisSocios : [["CEPs", "Nenhum registrado."]]);
  grupos.forEach(([tipo, titulo]) => {
    const locais = ceps.filter(c => c.tipo === tipo).map(c => [texto(c.cep), texto(c.endereco_validado)]);
    secao(titulo, locais.length ? locais : [["CEPs", "Nenhum registrado."]]);
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Diversidade.io | Ficha de cadastro", margem, 287);
    doc.text(`Página ${pagina} de ${paginas}`, 194, 287, { align: "right" });
  }
  return doc;
}

export function gerarFichaCadastroPdf(empresa: Registro, socios: Registro[], ceps: Registro[]): void {
  const nome = String(empresa.razao_social || empresa.nome_fantasia || empresa.id || "empresa")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80).toLowerCase();
  montarFichaCadastroPdf(empresa, socios, ceps).save(`ficha-cadastro-${nome || "empresa"}.pdf`);
}
