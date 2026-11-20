import * as XLSX from "xlsx";
import { mascaraTelefone } from "@/lib/mascaras";
import {
  CATEGORIAS,
  DECLARACOES,
  PERFIS_PARCEIRO,
  RESPOSTAS_COMPRADOR,
  STATUS_NEGOCIO,
  type MmEmpresa,
  type MmEvento,
  type MmNegocio,
  type MmParticipante,
  fotosDaEmpresa,
  formatarCnpj,
  formatarData,
  situacaoConfirmacao,
} from "@/lib/maioresMelhores";

const dataHora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR") : "");

/** Largura das colunas pelo conteúdo e células de "(link)" clicáveis. */
function prepararFolha(folha: XLSX.WorkSheet) {
  if (!folha["!ref"]) return;
  const faixa = XLSX.utils.decode_range(folha["!ref"]);
  const larguras: { wch: number }[] = [];
  for (let c = faixa.s.c; c <= faixa.e.c; c++) {
    const cabecalho = String(folha[XLSX.utils.encode_cell({ r: faixa.s.r, c })]?.v ?? "");
    const ehLink = cabecalho.endsWith("(link)");
    let largura = cabecalho.length;
    for (let r = faixa.s.r + 1; r <= faixa.e.r; r++) {
      const celula = folha[XLSX.utils.encode_cell({ r, c })];
      if (!celula || celula.v == null || celula.v === "") continue;
      if (ehLink && typeof celula.v === "string" && /^https?:\/\//i.test(celula.v)) {
        celula.l = { Target: celula.v, Tooltip: "Abrir foto" };
        celula.v = "Abrir foto";
        celula.t = "s";
        largura = Math.max(largura, 10);
      } else {
        largura = Math.max(largura, String(celula.v).length);
      }
    }
    larguras.push({ wch: Math.min(Math.max(largura + 2, 10), 60) });
  }
  folha["!cols"] = larguras;
}

/**
 * Gera a planilha completa da edição (empresas, sócios, negócios e participantes).
 * `fotos` traz o link temporário de cada foto (caminho no bucket → URL); sem ele a coluna de link fica vazia.
 */
export async function exportarEdicaoXlsx(
  evento: MmEvento,
  empresas: MmEmpresa[],
  negocios: MmNegocio[],
  participantes: MmParticipante[],
  fotos: Map<string, string> = new Map(),
) {
  const linkFoto = (caminho?: string | null) => (caminho ? fotos.get(caminho) ?? "" : "");
  const autorizada = (s: { foto_path?: string | null; foto_autorizada?: boolean }) =>
    s.foto_path ? (s.foto_autorizada ? "Sim" : "Não") : "";
  const maxSocios = Math.max(0, ...empresas.map((e) => e.socios.length));

  const pessoa = new Map(participantes.map((p) => [p.id, p]));
  const empresa = new Map(empresas.map((e) => [e.id, e]));

  const abaEmpresas = empresas.map((e) => {
    const p = e.participante_id ? pessoa.get(e.participante_id) : undefined;
    const validados = negocios.filter((n) => n.empresa_id === e.id && n.status === "validado");
    const colunasSocios: Record<string, string> = {};
    for (let i = 0; i < maxSocios; i++) {
      const s = e.socios[i];
      const prefixo = `Sócio ${i + 1} - `;
      colunasSocios[`${prefixo}Nome`] = s?.nome ?? "";
      colunasSocios[`${prefixo}Autodeclaração`] = s ? DECLARACOES[s.declaracao] : "";
      colunasSocios[`${prefixo}Foto autorizada`] = s ? autorizada(s) : "";
      colunasSocios[`${prefixo}Foto (link)`] = s ? linkFoto(s.foto_path) : "";
    }
    return {
      "Inscrita em": dataHora(e.criado_em),
      Categoria: CATEGORIAS[e.categoria],
      Porte: e.porte,
      "Razão social": e.razao_social,
      CNPJ: formatarCnpj(e.cnpj),
      "Responsável": e.responsavel,
      "E-mail de contato": e.email,
      "Município": e.municipio,
      UF: e.uf,
      "Sócios (autodeclaração)": e.socios.map((s) => `${s.nome} (${DECLARACOES[s.declaracao]})`).join("; "),
      "Fotos enviadas": fotosDaEmpresa(e).length,
      ...colunasSocios,
      "Participante": p?.nome ?? "",
      "E-mail do participante": p?.email ?? "",
      "Telefone do participante": p ? mascaraTelefone(p.telefone) : "",
      "Negócios registrados": negocios.filter((n) => n.empresa_id === e.id).length,
      "Negócios validados": validados.length,
      "Parceiros distintos validados": new Set(validados.map((n) => n.cnpj_parceiro)).size,
      "Valor validado (R$)": validados.reduce((s, n) => s + n.valor_centavos, 0) / 100,
    };
  });

  const abaSocios = empresas.flatMap((e) =>
    e.socios.map((s, i) => ({
      "Razão social": e.razao_social,
      CNPJ: formatarCnpj(e.cnpj),
      Categoria: CATEGORIAS[e.categoria],
      "Ordem": i + 1,
      "Sócio ou titular": s.nome,
      "Responsável pela inscrição": e.categoria === "afro" && i === 0 ? "Sim" : "Não",
      "Autodeclaração": DECLARACOES[s.declaracao],
      "Enviou foto": s.foto_path ? "Sim" : "Não",
      "Uso da foto autorizado": autorizada(s),
      "Foto (link)": linkFoto(s.foto_path),
    })),
  );

  const abaNegocios = negocios.map((n) => {
    const e = empresa.get(n.empresa_id);
    return {
      "Registrado em": dataHora(n.criado_em),
      "Empresa inscrita": e?.razao_social ?? "",
      "CNPJ inscrita": e ? formatarCnpj(e.cnpj) : "",
      Categoria: e ? CATEGORIAS[e.categoria] : "",
      "Empresa parceira": n.razao_social_parceiro,
      "CNPJ parceira": formatarCnpj(n.cnpj_parceiro),
      "Perfil da parceira": PERFIS_PARCEIRO[n.perfil_parceiro],
      "CNPJ compradora": formatarCnpj(n.cnpj_comprador),
      "CNPJ vendedora": formatarCnpj(n.cnpj_vendedor),
      "Número da nota": n.numero_nota,
      "Série": n.serie_nota,
      "Data de emissão": formatarData(n.data_emissao),
      "Valor (R$)": n.valor_centavos / 100,
      "E-mail do comprador": n.email_comprador,
      "WhatsApp do comprador": n.whatsapp_comprador ? mascaraTelefone(n.whatsapp_comprador) : "",
      "Confirmação do comprador": n.resposta_comprador ? RESPOSTAS_COMPRADOR[n.resposta_comprador] : situacaoConfirmacao(n),
      "Respondido em": dataHora(n.respondido_em),
      "Observação do comprador": n.observacao_comprador ?? "",
      "Situação": STATUS_NEGOCIO[n.status],
      "Motivo do indeferimento": n.motivo,
      "Revisado por": n.revisado_por ?? "",
      "Revisado em": dataHora(n.revisado_em),
    };
  });

  const abaParticipantes = participantes.map((p) => ({
    "Primeiro acesso": dataHora(p.criado_em),
    Nome: p.nome,
    "E-mail": p.email,
    Telefone: mascaraTelefone(p.telefone),
    "Empresas inscritas": empresas.filter((e) => e.participante_id === p.id).map((e) => e.razao_social).join("; "),
  }));

  const livro = XLSX.utils.book_new();
  const adicionar = (linhas: Record<string, unknown>[], nome: string) => {
    const folha = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ "Sem registros": "" }]);
    prepararFolha(folha);
    XLSX.utils.book_append_sheet(livro, folha, nome);
  };
  adicionar(abaEmpresas, "Empresas");
  adicionar(abaSocios, "Sócios");
  adicionar(abaNegocios, "Negócios");
  adicionar(abaParticipantes, "Participantes");
  XLSX.writeFile(livro, `maiores-e-melhores-${evento.ano}.xlsx`);
}
