/**
 * Monta o PDF do Relatorio de Auditoria de ponta a ponta, com os mesmos
 * agregadores que a API usa, e verifica que o documento sai inteiro.
 *
 * O que este teste pega e a classe de erro que so aparece na hora de desenhar:
 * campo ausente virando `undefined` dentro do jsPDF, tabela sem coluna, texto
 * que nao e string. O visual em si continua sendo conferido a olho — defina
 * RELATORIO_PDF_SAIDA para gravar o arquivo e abri-lo.
 */
import { describe, expect, it, vi } from "vitest";

/**
 * No navegador, `?inline` entrega a logo como data URI. Sob o vitest o Vite
 * devolve so um caminho, entao o jsPDF nao teria imagem nenhuma para embutir e
 * o caminho do cabecalho com logo ficaria sem cobertura — o mock repoe os bytes
 * reais do arquivo.
 */
vi.mock("@/assets/logo.png?inline", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const caminho = fileURLToPath(new URL("../client/src/assets/logo.png", import.meta.url));
  return { default: "data:image/png;base64," + readFileSync(caminho).toString("base64") };
});
import { writeFileSync } from "node:fs";
import {
  agregarUsuarios,
  montarLinhasSolicitacoes,
  resumirPeriodo,
  serieAcessos,
} from "../api/_relatorio";
import { montarDocumentoRelatorio, type DadosRelatorio } from "../client/src/lib/relatorioEmpresaPdf";

const FIM = new Date("2026-09-10T18:00:00-03:00");
const INICIO = new Date("2026-08-11T18:00:00-03:00");

const MEMBROS = [
  { id: "m1", auth_user_id: "a1", nome: "Andreive Ribeiro Souza", email: "andreive.sousa@sebrae.com.br", papel: "admin" },
  { id: "m2", auth_user_id: "a2", nome: "Jesse Paiva Silva", email: "jesse.silva@sebrae.com.br", papel: "usuario" },
  { id: "m3", auth_user_id: "a3", nome: "Marina Gonçalves de Assunção", email: "marina.assuncao@sebrae.com.br", papel: "usuario" },
  { id: "m4", auth_user_id: "a4", nome: "Convidado Que Nunca Entrou", email: "sem.acesso@sebrae.com.br", papel: "usuario" },
];

/** Trinta dias de acessos com buracos, para o grafico ter altos e baixos. */
function logsDeExemplo() {
  const eventos: any[] = [];
  for (let dia = 0; dia < 30; dia += 1) {
    const data = new Date(INICIO.getTime() + dia * 86_400_000);
    const quantidade = dia % 7 === 0 ? 0 : (dia % 5) + 1;
    for (let i = 0; i < quantidade; i += 1) {
      const quando = new Date(data.getTime() + i * 3_600_000).toISOString();
      eventos.push({
        email: MEMBROS[i % 3].email,
        tipo_evento: "login_sucesso",
        criado_em: quando,
        detalhes: null,
      });
      eventos.push({
        email: MEMBROS[i % 3].email,
        tipo_evento: "usuario_pesquisa_empresa",
        criado_em: quando,
        detalhes: "termo: padaria artesanal em Campinas",
      });
    }
  }
  eventos.push({
    email: MEMBROS[1].email,
    tipo_evento: "login_falha",
    criado_em: FIM.toISOString(),
    detalhes: "senha incorreta",
  });
  return eventos.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
}

const SOLICITACOES = [
  { usuario_id: "a2", criado_em: "2026-09-09T14:00:00Z", cnaes: ["4711-3/02", "5611-2/01"], cidade: "Campinas", modalidade: "ambos", status: "pendente" },
  { usuario_id: "a1", criado_em: "2026-09-02T14:00:00Z", cnaes: ["9602-5/01"], cidade: "São Paulo", modalidade: "presencial", status: "concluido" },
  { usuario_id: "a3", criado_em: "2026-08-20T14:00:00Z", cnaes: ["6201-5/01", "6202-3/00", "6209-1/00"], cidade: "Recife", modalidade: "online", status: "em_andamento" },
  { usuario_id: null, criado_em: "2026-08-14T14:00:00Z", cnaes: [], cidade: "Belo Horizonte", modalidade: "online", status: "cancelado" },
];

function dadosDeExemplo(): DadosRelatorio {
  const eventos = logsDeExemplo();
  const usuarios = agregarUsuarios(MEMBROS, eventos, SOLICITACOES);

  return {
    empresa: {
      id: "e1",
      razao_social: "Serviço de Apoio às Micro e Pequenas Empresas de São Paulo",
      nome_fantasia: "Sebrae-SP",
      cnpj: "43.728.245/0001-99",
      email: "andreive.sousa@sebrae.com.br",
      nome_responsavel: "Andreive Ribeiro Souza",
      telefone_principal: "(11) 3177-4800",
      status_aprovacao: "aprovado",
      situacao_cnpj: "ATIVA",
      area_empresa: "Apoio a micro e pequenas empresas",
      area_geografica: "Estado de São Paulo",
      created_at: "2025-11-03T12:00:00Z",
    },
    periodo: { chave: "30d", inicio: INICIO.toISOString(), fim: FIM.toISOString() },
    resumo: resumirPeriodo(usuarios, SOLICITACOES),
    usuarios,
    serieAcessos: serieAcessos(eventos, INICIO, FIM),
    solicitacoes: montarLinhasSolicitacoes(SOLICITACOES, MEMBROS),
    eventos: eventos.slice(0, 120),
    acoesAdm: [
      { criado_em: "2026-09-01T11:00:00Z", tipo_evento: "adm_aprovar_empresa", detalhes: "Cadastro aprovado após conferência do CNPJ", executor_adm_email: "contato@pomartech.com.br" },
      { criado_em: "2026-08-15T11:00:00Z", tipo_evento: "adm_ver_empresa", detalhes: null, executor_adm_email: "contato@pomartech.com.br" },
    ],
    totalEventos: eventos.length,
    eventosTruncados: eventos.length > 120,
  };
}

const ROTULOS: Record<string, string> = {
  login_sucesso: "Login",
  login_falha: "Falha de Login",
  usuario_pesquisa_empresa: "Pesquisou",
  adm_aprovar_empresa: "ADM - Aprovou",
  adm_ver_empresa: "ADM - Visualizou",
};
const opcoes = { rotularEvento: (tipo: string) => ROTULOS[tipo] || tipo };

describe("montarDocumentoRelatorio", () => {
  it("monta o relatorio completo em varias paginas", async () => {
    const doc = await montarDocumentoRelatorio(dadosDeExemplo(), opcoes);

    expect(doc.getNumberOfPages()).toBeGreaterThan(2);

    const saida = process.env.RELATORIO_PDF_SAIDA;
    if (saida) writeFileSync(saida, Buffer.from(doc.output("arraybuffer")));
  });

  /** Empresa recem-cadastrada: o PDF nao pode quebrar por falta de dados. */
  it("monta o relatorio de uma empresa sem nenhum acesso, solicitacao ou evento", async () => {
    const usuarios = agregarUsuarios(MEMBROS, [], []);
    const vazio: DadosRelatorio = {
      empresa: { razao_social: "Padaria da Esquina LTDA" },
      periodo: { chave: "tudo", inicio: null, fim: FIM.toISOString() },
      resumo: resumirPeriodo(usuarios, []),
      usuarios,
      serieAcessos: [],
      solicitacoes: [],
      eventos: [],
      acoesAdm: [],
      totalEventos: 0,
      eventosTruncados: false,
    };

    const doc = await montarDocumentoRelatorio(vazio, opcoes);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const saida = process.env.RELATORIO_PDF_SAIDA_VAZIO;
    if (saida) writeFileSync(saida, Buffer.from(doc.output("arraybuffer")));
  });

  /** Campos opcionais ausentes eram o jeito mais facil de o jsPDF receber undefined. */
  it("monta o relatorio quando a empresa nao tem telefone, area nem CNPJ", async () => {
    const usuarios = agregarUsuarios([{ nome: null, email: "so@email.com" }], [], []);
    const doc = await montarDocumentoRelatorio(
      {
        empresa: { nome_fantasia: "Sem Ficha Completa" },
        periodo: { chave: "90d", inicio: INICIO.toISOString(), fim: FIM.toISOString() },
        resumo: resumirPeriodo(usuarios, []),
        usuarios,
        serieAcessos: [{ rotulo: "01/09", total: 0 }],
        solicitacoes: [],
        eventos: [{ criado_em: FIM.toISOString(), email: "so@email.com", tipo_evento: "evento_novo_ainda_sem_rotulo", detalhes: null }],
        acoesAdm: [],
        totalEventos: 1,
        eventosTruncados: false,
      },
      opcoes,
    );

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
