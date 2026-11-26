import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { normalizarCnpj, UFS, type MmEmpresa, type MmEvento } from "@/lib/maioresMelhores";
import {
  dataVoto, estadosVotacao, horarioBrasilia, ordenarRanking, urlPublica, TITULO_VOTACAO_MM,
  type CategoriaVoto, type ConcorrenteVoto, type ConfiguracaoVoto, type RankingVoto,
} from "@/lib/maioresMelhoresVotacao";
import { RankingVotacao } from "@/components/maiores-melhores/RankingVotacao";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mm } from "@/components/maiores-melhores/estilo";

type Voto = { id: string; categoria_id: string; concorrente_id: string; email: string; criado_em: string };
type Total = { categoria_id: string | null; votos: number; emails: number };

const COLUNAS = "id,categoria_id,concorrente_id,email,criado_em";
const vazio = {
  categoria_id: "", nome: "", razao_social: "", cnpj: "", responsavel: "", descricao: "",
  cidade: "", uf: "", logo: "", foto: "", site: "", instagram: "", publicado: false,
};
const campos = [
  ["nome", "Nome público", true], ["razao_social", "Razão social", false], ["cnpj", "CNPJ", false],
  ["responsavel", "Responsável", true], ["cidade", "Cidade", true], ["logo", "URL do logotipo", false],
  ["foto", "URL da foto autorizada", false], ["site", "URL do site", false], ["instagram", "URL do Instagram", false],
] as const;

function erroDaOperacao(erro: unknown) {
  return (erro as { message?: string }).message || "Não foi possível concluir a operação.";
}

export default function VotacaoAdm({ evento, empresas }: { evento: MmEvento; empresas: MmEmpresa[] }) {
  const id = evento.id;
  const [config, setConfig] = useState<ConfiguracaoVoto | null>();
  const [categorias, setCategorias] = useState<CategoriaVoto[]>([]);
  const [concorrentes, setConcorrentes] = useState<ConcorrenteVoto[]>([]);
  const [ranking, setRanking] = useState<RankingVoto[]>([]);
  const [totais, setTotais] = useState<Total[]>([]);
  const [auditoriaAberta, setAuditoriaAberta] = useState(false);
  const [emailAuditoria, setEmailAuditoria] = useState("");
  const [dataAuditoria, setDataAuditoria] = useState("");
  const [limite, setLimite] = useState(20);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState("");
  const [erroAuditoria, setErroAuditoria] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [edicao, setEdicao] = useState<ConcorrenteVoto | null>();
  const [publicar, setPublicar] = useState(false);
  const atual = categorias.find((c) => c.id === categoria) ?? categorias[0];
  const total = totais.find((t) => t.categoria_id === null);
  const definitivo = config?.estado === "publicada";

  const carregar = useCallback(async (signal: AbortSignal) => {
    try {
      const [c, g, n, r, t] = await Promise.all([
        supabase.from("mm_votacoes").select("inicio,fim,estado").eq("evento_id", id).abortSignal(signal).maybeSingle(),
        supabase.from("mm_voto_categorias").select("id,nome,ativa,catalogo").eq("evento_id", id).order("catalogo", { ascending: false }).order("nome").abortSignal(signal),
        supabase.from("mm_voto_concorrentes").select("*").eq("evento_id", id).order("nome").abortSignal(signal),
        supabase.from("mm_voto_ranking").select("*").eq("evento_id", id).abortSignal(signal),
        supabase.from("mm_voto_totais").select("categoria_id,votos,emails").eq("evento_id", id).abortSignal(signal),
      ]);
      const falha = c.error || g.error || n.error || r.error || t.error;
      if (falha) throw falha;
      if (signal.aborted) return;
      setConfig(c.data as ConfiguracaoVoto | null);
      setCategorias(g.data);
      setConcorrentes(n.data);
      setRanking(r.data);
      setTotais(t.data);
      setErro("");
    } catch (e) {
      if (!signal.aborted) setErro(erroDaOperacao(e));
    }
  }, [id]);

  const carregarAuditoria = useCallback(async (signal: AbortSignal) => {
    let consulta = supabase.from("mm_votos").select(COLUNAS).eq("evento_id", id);
    const email = emailAuditoria.trim();
    if (email) consulta = consulta.ilike("email", "%" + email.replace(/[\\%_*]/g, "\\$&") + "%");
    if (dataAuditoria) {
      const inicio = new Date(dataAuditoria + "T00:00:00-03:00");
      const fim = new Date(inicio.getTime() + 86400000);
      if (Number.isFinite(+inicio)) consulta = consulta.gte("criado_em", inicio.toISOString()).lt("criado_em", fim.toISOString());
    }
    const { data, error } = await consulta
      .order("criado_em", { ascending: false }).order("id", { ascending: false })
      .range(pagina * limite, (pagina + 1) * limite).abortSignal(signal);
    if (signal.aborted) return;
    setErroAuditoria(error?.message ?? "");
    setVotos(data?.slice(0, limite) ?? []);
    setTemMais((data?.length ?? 0) > limite);
    setCarregandoAuditoria(false);
  }, [id, pagina, limite, emailAuditoria, dataAuditoria]);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    const timer = window.setInterval(() => void carregar(controle.signal), 15000);
    return () => { window.clearInterval(timer); controle.abort(); };
  }, [carregar]);

  useEffect(() => {
    if (!auditoriaAberta) return;
    const controle = new AbortController();
    setCarregandoAuditoria(true);
    const busca = window.setTimeout(() => void carregarAuditoria(controle.signal), 250);
    const timer = window.setInterval(() => {
      if (pagina === 0) void carregarAuditoria(controle.signal);
    }, 15000);
    return () => { window.clearTimeout(busca); window.clearInterval(timer); controle.abort(); };
  }, [auditoriaAberta, carregarAuditoria, pagina]);

  async function operar(acao: () => Promise<void>, sucesso: string) {
    setOcupado(true);
    try {
      await acao();
      await carregar(new AbortController().signal);
      toast.success(sucesso);
    } catch (e) {
      toast.error(erroDaOperacao(e));
    } finally {
      setOcupado(false);
    }
  }

  function salvarPeriodo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const inicio = new Date(dados.get("inicio") + ":00-03:00");
    const ultimoMinuto = new Date(dados.get("fim") + ":00-03:00");
    const fim = new Date(ultimoMinuto.getTime() + 60000);
    if (!Number.isFinite(+inicio) || !Number.isFinite(+fim) || fim <= inicio) {
      toast.error("Informe um período válido.");
      return;
    }
    const periodo = { inicio: inicio.toISOString(), fim: fim.toISOString() };
    void operar(async () => {
      const resultado = config
        ? await supabase.from("mm_votacoes").update(periodo).eq("evento_id", id)
        : await supabase.from("mm_votacoes").insert({ ...periodo, evento_id: id });
      if (resultado.error) throw resultado.error;
    }, "Período salvo.");
  }

  function mudarEstado(estado: ConfiguracaoVoto["estado"]) {
    void operar(async () => {
      const { data, error } = await supabase.from("mm_votacoes").update({ estado })
        .eq("evento_id", id).eq("estado", config?.estado).select("estado").single();
      if (error || !data) throw error ?? new Error("O estado da votação mudou. Atualize a página.");
      setPublicar(false);
    }, estadosVotacao[estado] + ".");
  }

  function salvarCategoria(e: FormEvent<HTMLFormElement>, editar: CategoriaVoto) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const nome = String(dados.get("nome") ?? "").trim();
    void operar(async () => {
      const { error } = await supabase.from("mm_voto_categorias").update({ nome, ativa: dados.has("ativa") }).eq("id", editar.id);
      if (error) throw error;
    }, "Categoria salva.");
  }

  async function exportar() {
    const livro = XLSX.utils.book_new();
    const auditados: Voto[] = [];
    // A data do corte exclui novas linhas durante a paginação da exportação.
    const { data: ultimo, error } = await supabase.from("mm_votos").select("criado_em")
      .eq("evento_id", id).order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (ultimo) {
      for (let i = 0; ; i += 500) {
        const { data, error: falha } = await supabase.from("mm_votos").select(COLUNAS).eq("evento_id", id)
          .lte("criado_em", ultimo.criado_em).order("criado_em", { ascending: false })
          .order("id", { ascending: false }).range(i, i + 499);
        if (falha) throw falha;
        auditados.push(...data);
        if (data.length < 500) break;
      }
    }
    const { data: classificacao, error: falhaRanking } = await supabase.from("mm_voto_ranking").select("*").eq("evento_id", id);
    if (falhaRanking) throw falhaRanking;
    const nomeCategoria = (chave: string) => categorias.find((c) => c.id === chave)?.nome ?? chave;
    XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(ordenarRanking(classificacao).map((r) => ({
      Categoria: nomeCategoria(r.categoria_id), Posição: r.votos > 0 ? r.posicao : null, Concorrente: r.nome, Votos: r.votos,
      "Percentual de votos recebidos": r.percentual,
    })), { header: ["Categoria", "Posição", "Concorrente", "Votos", "Percentual de votos recebidos"] }), "Classificação");
    XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(auditados.map((v) => ({
      Categoria: nomeCategoria(v.categoria_id),
      Concorrente: concorrentes.find((c) => c.id === v.concorrente_id)?.nome ?? v.concorrente_id,
      "E-mail": v.email, "Data e hora (Brasília)": dataVoto.format(new Date(v.criado_em)), ID: v.id,
    })), { header: ["Categoria", "Concorrente", "E-mail", "Data e hora (Brasília)", "ID"] }), "Votos");
    XLSX.writeFile(livro, "votacao-maiores-e-melhores-" + evento.ano + ".xlsx");
  }

  if (erro && config === undefined) return <p role="alert" className={mm.falha}>{erro}</p>;
  if (config === undefined) return <p role="status">Carregando votação…</p>;

  return <section className={mm.painel + " grid gap-6"} aria-labelledby="titulo-votacao-adm">
    <h2 id="titulo-votacao-adm" className={mm.titulo}>{TITULO_VOTACAO_MM}</h2>
    {erro && <p role="alert" className={mm.falha}>{erro}</p>}
    <form key={(config?.inicio ?? "") + (config?.fim ?? "")} onSubmit={salvarPeriodo} className="grid gap-3">
      <div className={mm.grade}>
        <label className={mm.rotulo}>Abertura (Brasília)
          <input name="inicio" type="datetime-local" required disabled={definitivo}
            defaultValue={config ? horarioBrasilia(config.inicio) : ""} className={mm.campo} />
        </label>
        <label className={mm.rotulo}>Último minuto para votar (Brasília)
          <input name="fim" type="datetime-local" required disabled={definitivo}
            defaultValue={config ? horarioBrasilia(new Date(Date.parse(config.fim) - 1).toISOString()) : ""} className={mm.campo} />
        </label>
      </div>
      {!definitivo && <button className={mm.botaoSecundario + " justify-self-start"} disabled={ocupado}>{config ? "Salvar período" : "Configurar votação"}</button>}
    </form>
    {config && <>
      <div className="flex flex-wrap items-center gap-2">
        <strong>{estadosVotacao[config.estado]}</strong>
        {!definitivo && config.estado !== "ativa" && config.estado !== "encerrada" &&
          <button type="button" className={mm.botao} disabled={ocupado} onClick={() => mudarEstado("ativa")}>Ativar votação</button>}
        {config.estado === "ativa" &&
          <button type="button" className={mm.botaoSecundario} disabled={ocupado} onClick={() => mudarEstado("suspensa")}>Suspender</button>}
        {(config.estado === "ativa" || config.estado === "suspensa") &&
          <button type="button" className={mm.botaoSecundario} disabled={ocupado} onClick={() => mudarEstado("encerrada")}>Encerrar votação</button>}
        {config.estado === "encerrada" &&
          <button type="button" className={mm.botao} disabled={ocupado} onClick={() => setPublicar(true)}>Publicar resultado definitivo</button>}
        <button type="button" className={mm.botaoSecundario} disabled={ocupado}
          onClick={() => void operar(exportar, "Planilha exportada.")}>Exportar votos e classificação</button>
      </div>
      {publicar && <div className={mm.info} role="group" aria-label="Confirmação da publicação">
        <p>A publicação torna a classificação definitiva e bloqueia a edição das categorias e candidaturas.</p>
        <div className={mm.acoes}>
          <button type="button" className={mm.botao} disabled={ocupado} onClick={() => mudarEstado("publicada")}>Confirmar publicação</button>
          <button type="button" className={mm.botaoSecundario} disabled={ocupado} onClick={() => setPublicar(false)}>Cancelar</button>
        </div>
      </div>}
      <Dialog open={auditoriaAberta} onOpenChange={setAuditoriaAberta}>
        <div className={mm.info + " flex flex-wrap items-center justify-between gap-3"}>
          <p>{total?.votos ?? 0} votos · {total?.emails ?? 0} e-mails distintos · {concorrentes.length} concorrentes cadastrados</p>
          <DialogTrigger asChild>
            <button type="button" className={mm.botaoSecundario}>Auditoria dos votos</button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Auditoria dos votos</DialogTitle>
            <DialogDescription>Consulte os votos registrados nesta edição.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <label className={mm.rotulo}>Pesquisar por e-mail
              <input type="search" className={mm.campo} value={emailAuditoria}
                onChange={(e) => { setEmailAuditoria(e.target.value); setPagina(0); }} />
            </label>
            <label className={mm.rotulo}>Data (Brasília)
              <input type="date" className={mm.campo} value={dataAuditoria}
                onChange={(e) => { setDataAuditoria(e.target.value); setPagina(0); }} />
            </label>
            <label className={mm.rotulo}>Votos por página
              <select className={mm.campo} value={limite}
                onChange={(e) => { setLimite(Number(e.target.value)); setPagina(0); }}>
                {[20, 50, 100].map((valor) => <option key={valor} value={valor}>{valor}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className={mm.botaoSecundario + " justify-self-start"} disabled={ocupado}
            onClick={() => void operar(exportar, "Planilha exportada.")}>Exportar votos e classificação</button>
          {carregandoAuditoria && <p role="status" className={mm.dica}>Carregando votos…</p>}
          {erroAuditoria && <p role="alert" className={mm.falha}>{erroAuditoria}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th>Data e hora (Brasília)</th><th>E-mail</th><th>Categoria</th><th>Concorrente</th></tr></thead>
              <tbody>
                {!carregandoAuditoria && votos.map((v) => <tr key={v.id} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap">{dataVoto.format(new Date(v.criado_em))}</td>
                  <td className="pr-3">{v.email}</td>
                  <td className="pr-3">{categorias.find((c) => c.id === v.categoria_id)?.nome ?? v.categoria_id}</td>
                  <td>{concorrentes.find((c) => c.id === v.concorrente_id)?.nome ?? v.concorrente_id}</td>
                </tr>)}
              </tbody>
            </table>
            {!votos.length && !erroAuditoria && !carregandoAuditoria && <p className={mm.dica}>Nenhum voto nesta página.</p>}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className={mm.botaoSecundario} disabled={pagina === 0 || carregandoAuditoria} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span>Página {pagina + 1}</span>
            <button type="button" className={mm.botaoSecundario} disabled={!temMais || carregandoAuditoria} onClick={() => setPagina(pagina + 1)}>Próxima</button>
          </div>
        </DialogContent>
      </Dialog>
      {atual && <>
        <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">Categoria para apuração</legend>
          <div className="grid gap-2 lg:grid-cols-3">
            {categorias.map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === atual.id}
                className={c.id === atual.id ? mm.botao : mm.botaoSecundario}
                onClick={() => { setCategoria(c.id); setEdicao(undefined); }}>
                {c.nome}
              </button>
            ))}
          </div>
        </fieldset>
        {!definitivo && !atual.catalogo && <form key={atual.id + atual.nome + atual.ativa} onSubmit={(e) => salvarCategoria(e, atual)}
          className="flex flex-wrap gap-3 items-end">
          <label className={mm.rotulo + " flex-1"}>Nome da categoria
            <input name="nome" className={mm.campo} required maxLength={150} defaultValue={atual.nome} />
          </label>
          <label className={mm.marcar + " mb-2"}><input className={mm.checkbox} type="checkbox" name="ativa" defaultChecked={atual.ativa} /> Ativa</label>
          <button className={mm.botaoSecundario} disabled={ocupado}>Salvar categoria</button>
        </form>}
        <h3 className="font-bold">Classificação da categoria</h3>
        <p className={mm.dica}>{totais.find((t) => t.categoria_id === atual.id)?.votos ?? 0} votos registrados na categoria.
          A classificação considera os concorrentes publicados nas categorias ativas.</p>
        <RankingVotacao linhas={ranking.filter((r) => r.categoria_id === atual.id)} />
        <h3 className="font-bold">Concorrentes</h3>
        {atual.catalogo && !definitivo && <button type="button" className={mm.botaoSecundario + " justify-self-start"}
          disabled={ocupado} onClick={() => void operar(async () => {
            const { error } = await supabase.rpc("mm_atualizar_catalogo_votacao", { p_evento: id });
            if (error) throw error;
          }, "Empreendimentos atualizados.")}>Atualizar empreendimentos da plataforma</button>}
        {!definitivo && !atual.catalogo && <button type="button" className={mm.botaoSecundario + " justify-self-start"} onClick={() => setEdicao(null)}>
          Cadastrar ou importar
        </button>}
        {!definitivo && !atual.catalogo && edicao !== undefined && <EditorConcorrente key={edicao?.id ?? atual.id} categoria={atual.id}
          selecionado={edicao} empresas={empresas} ocupado={ocupado} fechar={() => setEdicao(undefined)}
          salvar={(dados) => void operar(async () => {
            const resultado = edicao
              ? await supabase.from("mm_voto_concorrentes").update(dados).eq("id", edicao.id)
              : await supabase.from("mm_voto_concorrentes").insert({ ...dados, evento_id: id, categoria_id: atual.id });
            if (resultado.error) throw resultado.error;
            setEdicao(undefined);
          }, "Concorrente salvo.")} />}
        <ul className="grid gap-2">
          {concorrentes.filter((c) => c.categoria_id === atual.id).map((c) => <li key={c.id} className={mm.cartao + " flex flex-wrap items-center gap-2"}>
            <span className="flex-1"><strong>{c.nome}</strong> · {c.publicado ? "Publicado" : "Não publicado"}</span>
            {!definitivo && !atual.catalogo && <button type="button" className={mm.botaoSecundario} onClick={() => setEdicao(c)}>Editar</button>}
          </li>)}
        </ul>
      </>}
    </>}
  </section>;
}

type DadosConcorrente = Omit<ConcorrenteVoto, "id" | "categoria_id">;

function EditorConcorrente({ selecionado, categoria, empresas, ocupado, fechar, salvar }: {
  selecionado: ConcorrenteVoto | null; categoria: string; empresas: MmEmpresa[]; ocupado: boolean;
  fechar(): void; salvar(dados: DadosConcorrente): void;
}) {
  const [dados, setDados] = useState({ ...vazio, ...selecionado, categoria_id: categoria });
  const [cnpj, setCnpj] = useState("");
  const [importando, setImportando] = useState(false);

  async function importarCadastro() {
    const documento = normalizarCnpj(cnpj);
    if (documento.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setImportando(true);
    try {
      const mascara = documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
      const { data, error } = await supabase.from("empresas")
        .select("nome_fantasia,razao_social,nome_responsavel,atividade_empresarial")
        .in("cnpj", [documento, mascara]).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cadastro não encontrado na base.");
      setDados((d) => ({
        ...d, nome: data.nome_fantasia || data.razao_social || "", razao_social: data.razao_social,
        cnpj: documento, responsavel: data.nome_responsavel || "", descricao: data.atividade_empresarial || "",
      }));
    } catch (erro) {
      toast.error(erroDaOperacao(erro));
    } finally {
      setImportando(false);
    }
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const documento = normalizarCnpj(dados.cnpj ?? "");
    if (documento.length !== 0 && documento.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    if ([dados.logo, dados.foto, dados.site, dados.instagram].some((url) => url && !urlPublica(url))) {
      toast.error("Informe links HTTPS.");
      return;
    }
    salvar({
      nome: dados.nome.trim(), razao_social: dados.razao_social?.trim() || null, cnpj: documento || null,
      responsavel: dados.responsavel.trim(), descricao: dados.descricao.trim(), cidade: dados.cidade.trim(),
      uf: dados.uf, logo: dados.logo || null, foto: dados.foto || null, site: dados.site || null,
      instagram: dados.instagram || null, publicado: dados.publicado,
    });
  }

  return <form onSubmit={enviar} className={mm.cartao + " grid gap-4"}>
    <h4 className="font-bold">{selecionado ? "Editar concorrente" : "Cadastrar concorrente"}</h4>
    {!selecionado && <div className={mm.grade}>
      <label className={mm.rotulo}>Preencher com inscrição da edição
        <select className={mm.campo} defaultValue="" onChange={(e) => {
          const empresa = empresas.find((item) => item.id === e.target.value);
          if (empresa) setDados((d) => ({
            ...d, nome: empresa.razao_social, razao_social: empresa.razao_social, cnpj: empresa.cnpj,
            responsavel: empresa.responsavel, cidade: empresa.municipio, uf: empresa.uf,
          }));
        }}>
          <option value="">Selecione uma empresa</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
        </select>
      </label>
      <div className="flex gap-2 items-end">
        <label className={mm.rotulo + " flex-1"}>CNPJ na base Diversidade.io
          <input className={mm.campo} value={cnpj} inputMode="numeric" onChange={(e) => setCnpj(e.target.value)} />
        </label>
        <button className={mm.botaoSecundario} type="button" disabled={importando} onClick={() => void importarCadastro()}>Importar</button>
      </div>
    </div>}
    <div className={mm.grade}>
      {campos.map(([chave, rotulo, obrigatorio]) => <label key={chave} className={mm.rotulo}>
        {rotulo}
        <input className={mm.campo} value={dados[chave] ?? ""} required={obrigatorio}
          maxLength={chave === "nome" ? 150 : 500} onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))} />
      </label>)}
      <label className={mm.rotulo}>UF
        <select required className={mm.campo} value={dados.uf} onChange={(e) => setDados((d) => ({ ...d, uf: e.target.value }))}>
          <option value="">Selecione</option>
          {UFS.map((uf) => <option key={uf}>{uf}</option>)}
        </select>
      </label>
    </div>
    <label className={mm.rotulo}>Descrição pública
      <textarea className={mm.campo} value={dados.descricao} maxLength={1000} required
        onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))} />
    </label>
    <label className={mm.marcar}>
      <input className={mm.checkbox} type="checkbox" checked={dados.publicado}
        onChange={(e) => setDados((d) => ({ ...d, publicado: e.target.checked }))} />
      Confirmo a elegibilidade na categoria e autorizo a publicação da candidatura.
    </label>
    <div className={mm.acoes}>
      <button className={mm.botao} disabled={ocupado || importando}>Salvar concorrente</button>
      <button className={mm.botaoSecundario} type="button" onClick={fechar}>Cancelar</button>
    </div>
  </form>;
}
