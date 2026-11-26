import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { dataVoto, filtrarRanking, ROTA_ACOMPANHAR_MM, ROTA_VOTACAO_MM, TITULO_VOTACAO_MM, type CategoriaVoto, type RankingVoto } from "@/lib/maioresMelhoresVotacao";
import { Link } from "wouter";
import { Info } from "lucide-react";
import { API_VOTACAO_MM, useVotacaoMm, type Votacao } from "./useVotacaoMm";
import { mm } from "./estilo";
import { RankingVotacao } from "./RankingVotacao";

const CATEGORIA_INCLUSIVAS = "Empresas ou Iniciativas Inclusivas Mais Admiradas";
type EscolhaVoto = Pick<RankingVoto, "id" | "nome" | "categoria_id"> & { indicada?: boolean };

interface Turnstile {
  render(alvo: HTMLElement, opcoes: {
    sitekey: string;
    action: string;
    callback(token: string): void;
    "expired-callback"(): void;
    "error-callback"(): void;
  }): string;
  remove(id: string): void;
  reset(id: string): void;
}

let carregandoTurnstile: Promise<Turnstile> | undefined;
const chave = import.meta.env.VITE_MM_TURNSTILE_SITE_KEY;

function carregarTurnstile() {
  if (!carregandoTurnstile) {
    carregandoTurnstile = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => {
        const api = (window as Window & { turnstile?: Turnstile }).turnstile;
        if (api) resolve(api);
        else reject(new Error("Turnstile indisponível."));
      };
      script.onerror = () => { script.remove(); reject(new Error("Turnstile indisponível.")); };
      document.head.append(script);
    }).catch((erro) => {
      carregandoTurnstile = undefined;
      throw erro;
    });
  }
  return carregandoTurnstile;
}

function Verificacao({ aoValidar }: { aoValidar: (token: string) => void }) {
  const alvo = useRef<HTMLDivElement>(null);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!chave) return;
    setFalha(false);
    let ativo = true;
    let novaTentativa: number | undefined;
    let widget: { api: Turnstile; id: string } | undefined;
    function tentarNovamente() {
      if (!ativo) return;
      aoValidar("");
      if (tentativa > 0) setFalha(true);
      else if (novaTentativa === undefined) {
        novaTentativa = window.setTimeout(() => setTentativa(1), 1500);
      }
    }
    void carregarTurnstile().then((api) => {
      if (!ativo || !alvo.current) return;
      const id = api.render(alvo.current, {
        sitekey: chave,
        action: "mm-voto",
        callback: (token) => {
          if (!ativo) return;
          window.clearTimeout(novaTentativa);
          novaTentativa = undefined;
          setFalha(false);
          aoValidar(token);
        },
        "expired-callback": () => {
          aoValidar("");
          if (widget) api.reset(widget.id);
        },
        "error-callback": tentarNovamente,
      });
      widget = { api, id };
    }).catch(tentarNovamente);
    return () => {
      ativo = false;
      window.clearTimeout(novaTentativa);
      if (widget) widget.api.remove(widget.id);
    };
  }, [aoValidar, tentativa]);

  if (!chave) return <p className={mm.erro}>Verificação de segurança indisponível.</p>;
  return <div>
    <div ref={alvo} />
    {falha && <p role="alert" className={mm.erro}>Verificação de segurança indisponível. Tente novamente em instantes.</p>}
  </div>;
}

export default function VotacaoPublica({ evento }: { evento: string }) {
  const { dados, falhaLeitura, atualizar } = useVotacaoMm(evento);
  const [etapa, setEtapa] = useState<number>();
  const [email, setEmail] = useState("");
  const [escolhasDoLink] = useState(() =>
    [...new Set(new URLSearchParams(window.location.search).getAll("concorrente").map((id) => id.toLowerCase()))]
      .filter(Boolean).slice(0, 9));
  const [escolhas, setEscolhas] = useState(escolhasDoLink);
  const [indicacoes, setIndicacoes] = useState<EscolhaVoto[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const secao = useRef<HTMLElement>(null);
  const carregada = !!dados;

  useEffect(() => {
    if (!carregada) return;
    const alvo = window.location.hash.slice(1);
    if (alvo === "votacao") secao.current?.scrollIntoView();
    else if (alvo.startsWith("votacao-")) secao.current?.scrollIntoView();
  }, [carregada]);

  if (!dados) return <section className={mm.painel} aria-labelledby="votacao-titulo">
    <h2 id="votacao-titulo" className={mm.titulo}>{TITULO_VOTACAO_MM}</h2>
    {falhaLeitura ? <p className={mm.falha} role="alert">Não foi possível carregar a votação. A página tentará novamente.</p>
      : <p role="status">{dados === undefined ? "Carregando a votação…" : "A votação popular ainda não está disponível."}</p>}
  </section>;
  const confirmado = dados.estado === "publicada";
  const agendada = dados.estado === "ativa" && Date.now() < Date.parse(dados.inicio);
  const etapas = dados.categorias.length;
  const alvo = window.location.hash.slice(1);
  const inicioDoLink = dados.categorias.findIndex((categoria) => "votacao-" + categoria.id === alvo);
  const inicio = inicioDoLink >= 0 ? inicioDoLink : dados.categorias.findIndex((categoria) =>
    dados.ranking.some((linha) => linha.categoria_id === categoria.id && escolhasDoLink.includes(linha.id)));
  const atual = etapa ?? (alvo === "votacao-revisao" ? etapas : Math.max(0, inicio));
  const selecionadas = dados.categorias.flatMap<EscolhaVoto>((categoria) =>
    [...dados.ranking.filter((linha) => linha.categoria_id === categoria.id && escolhas.includes(linha.id)),
      ...indicacoes.filter((linha) => linha.categoria_id === categoria.id)].slice(0, 3));
  const selecionados = selecionadas.map((linha) => linha.id);
  const passos = [...dados.categorias, { id: "revisao", nome: "Revisão e confirmação" }];

  function irParaEtapa(indice: number) {
    setEtapa(indice);
    secao.current?.scrollIntoView();
  }

  function alternarEscolha(id: string) {
    if (indicacoes.some((linha) => linha.id === id)) {
      setIndicacoes((anteriores) => anteriores.filter((linha) => linha.id !== id));
      return;
    }
    setEscolhas(selecionados.includes(id) ? escolhas.filter((atualId) => atualId !== id) : [...escolhas, id]);
  }

  function pularCategoria(categoriaId: string) {
    const outras = selecionadas.filter((linha) => linha.categoria_id !== categoriaId);
    setEscolhas(outras.filter((linha) => !linha.indicada).map((linha) => linha.id));
    setIndicacoes(outras.filter((linha) => linha.indicada));
    irParaEtapa(atual + 1);
  }

  return (
    <section id="votacao" ref={secao} className={mm.painel + " mb-6 scroll-mt-24"} aria-labelledby="votacao-titulo">
      <h2 id="votacao-titulo" className={mm.titulo}>{TITULO_VOTACAO_MM}</h2>
      <div className="grid gap-5">
        <p className={mm.dica}>
          {confirmado ? "Resultado definitivo" : dados.aberta ? "Votação aberta" :
            dados.estado === "suspensa" ? "Votação suspensa" :
            agendada ? "Abertura em " + dataVoto.format(new Date(dados.inicio)) : "Votação encerrada"}
          {dados.aberta && " até " + dataVoto.format(new Date(Date.parse(dados.fim) - 1)) + " (horário de Brasília)"}
        </p>
        {falhaLeitura && <p role="status" className={mm.dica}>O ranking será atualizado na próxima consulta.</p>}
        {dados.aberta && etapas > 0 && atual < etapas && <div className="grid gap-2 text-left leading-relaxed text-[#62566f]">
          <p>A votação tem <strong>{etapas} {etapas === 1 ? "categoria" : "categorias"}</strong>:{" "}
            {dados.categorias.map((categoria) => categoria.nome).join(", ")}.
          </p>
          <p>Escolha até 3 empresas em cada categoria ou clique em <strong>Pular categoria</strong>.</p>
          <p>Na última etapa, revise suas escolhas, informe seu e-mail e confirme todos os votos de uma vez.</p>
        </div>}
        {dados.aberta && etapas > 0 && <div className="sticky top-0 z-30 grid justify-items-center gap-3 rounded-xl border border-[#e6dfec] bg-[#fbf8fc] px-4 py-3">
          <ol className="flex items-center gap-1 sm:gap-2" aria-label="Etapas da votação">
            {passos.map((categoria, indice) => (
              <li key={categoria.id} aria-current={indice === atual ? "step" : undefined} className="flex items-center gap-1 sm:gap-2">
                {indice > 0 && <span aria-hidden="true" className={"h-0.5 w-3 sm:w-10 " +
                  (indice <= atual ? "bg-[#ab83c7]" : "bg-[#e6dfec]")} />}
                <span className={"grid size-9 place-items-center rounded-full border text-lg font-extrabold sm:size-11 " +
                  (indice === atual ? "border-[#5c2686] bg-[#5c2686] text-white ring-2 ring-[#dfc9ef] ring-offset-2"
                    : indice < atual ? "border-[#d9c9e3] bg-[#f0e5f8] text-[#5c2686]"
                    : "border-[#d9c9e3] bg-white text-[#62566f]")}>
                  <span className="sr-only">Etapa {indice + 1}: {categoria.nome}</span>
                  <span aria-hidden="true">{indice + 1}</span>
                </span>
              </li>
            ))}
          </ol>
          <p role="status" className="text-center text-sm font-bold text-[#5c2686]">
            Etapa {atual + 1} de {passos.length}
          </p>
        </div>}
        {dados.aberta && etapas > 0 && atual === etapas && (
          <section id="votacao-revisao" aria-labelledby="votacao-revisao-titulo">
            <h3 id="votacao-revisao-titulo" className={mm.titulo}>Revisão e confirmação</h3>
            <ConfirmacaoFinal evento={evento} categorias={dados.categorias}
              selecionadas={selecionadas} escolhasDoLink={escolhasDoLink}
              email={email} aoAlterarEmail={setEmail} aoRemover={alternarEscolha} aoEnviar={setConfirmando}
              atualizar={atualizar} voltar={() => irParaEtapa(etapas - 1)}
              aoRegistrar={(ids) => { setEscolhas(ids); setIndicacoes([]); }} />
          </section>
        )}
        {dados.categorias.map((categoria, indice) => (
          <div key={categoria.id} hidden={dados.aberta && indice !== atual}>
            <AreaVotacao evento={evento} visivel={!dados.aberta || indice === atual}
              categoria={categoria} aberta={dados.aberta} confirmado={confirmado}
              linhas={dados.ranking.filter((linha) => linha.categoria_id === categoria.id)}
              selecionadas={selecionadas.filter((linha) => linha.categoria_id === categoria.id)}
              aoEscolher={alternarEscolha} confirmando={confirmando}
              aoIndicar={categoria.nome === CATEGORIA_INCLUSIVAS ? (nome) => setIndicacoes((anteriores) => [
                ...anteriores, { id: crypto.randomUUID(), nome, categoria_id: categoria.id, indicada: true },
              ]) : undefined}>
              {dados.aberta && indice === atual && <>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {selecionadas.some((linha) => linha.categoria_id === categoria.id) &&
                    <button type="button" className={mm.botao} onClick={() => irParaEtapa(atual + 1)}>
                      {atual + 1 === etapas ? "Revisar votos" : "Próxima em categoria"}
                    </button>}
                  {atual > 0 && <button type="button" className={mm.botaoSecundario}
                    onClick={() => irParaEtapa(atual - 1)}>Voltar</button>}
                  <button type="button" className={mm.botaoSecundario} onClick={() => pularCategoria(categoria.id)}>Pular categoria</button>
                </div>
              </>}
            </AreaVotacao>
          </div>
        ))}
      </div>
    </section>
  );
}

function AreaVotacao({ evento, visivel, categoria, aberta, confirmado, linhas, selecionadas, aoEscolher, aoIndicar, confirmando, children }: {
  evento: string;
  visivel: boolean;
  categoria: Pick<CategoriaVoto, "id" | "nome">;
  aberta: boolean;
  confirmado: boolean;
  linhas: RankingVoto[];
  selecionadas: EscolhaVoto[];
  aoEscolher(id: string): void;
  aoIndicar?(nome: string): void;
  confirmando: boolean;
  children?: ReactNode;
}) {
  const acoes = useRef<HTMLDivElement>(null);
  const [atingiuLimite, setAtingiuLimite] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultadoSocios, setResultadoSocios] = useState<{ termo: string; ids: string[] }>();
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(-1);
  const [pagina, setPagina] = useState(0);
  const [limite, setLimite] = useState(5);
  const [mostraIndicacao, setMostraIndicacao] = useState(false);
  const [mostraAjuda, setMostraAjuda] = useState(false);
  const [nomeIndicado, setNomeIndicado] = useState("");
  const [erroIndicacao, setErroIndicacao] = useState("");
  const termoSocio = busca.trim();
  const filtradas = filtrarRanking(linhas, busca, resultadoSocios?.termo === termoSocio ? resultadoSocios.ids : []);
  const categoriaId = categoria.id;

  useEffect(() => {
    if (!visivel || termoSocio.length < 3) return;
    const controle = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const parametros = new URLSearchParams({ evento, categoria: categoriaId, socio: termoSocio });
        const resposta = await fetch(API_VOTACAO_MM + "?" + parametros, { signal: controle.signal });
        if (!resposta.ok) return;
        const dados = await resposta.json();
        if (!controle.signal.aborted && Array.isArray(dados.concorrentes)) {
          setResultadoSocios({ termo: termoSocio, ids: dados.concorrentes });
        }
      } catch {
        // A busca por nome e razão social continua disponível.
      }
    }, 250);
    return () => { window.clearTimeout(timer); controle.abort(); };
  }, [categoriaId, evento, termoSocio, visivel]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / limite));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const inicioPagina = paginaAtual * limite;
  const visiveis = filtradas.slice(inicioPagina, inicioPagina + limite);
  const indicacoesLocais: RankingVoto[] = selecionadas.filter((linha) => linha.indicada).map((linha) => ({
    ...linha, descricao: "Sua indicação será publicada ao confirmar os votos.",
    cidade: "", uf: "", logo: null, foto: null, site: null, instagram: null,
    votos: 0, posicao: 0, percentual: 0,
  }));
  const total = linhas.reduce((soma, linha) => soma + linha.votos, 0);
  const selecionados = selecionadas.map((linha) => linha.id);
  const areaId = "votacao-" + categoria.id;
  const tituloId = areaId + "-titulo";
  const sugestoesId = areaId + "-sugestoes";
  const sugestoes = filtradas.slice(0, 6);
  const mostrarSugestoes = sugestoesAbertas && sugestoes.length > 0;

  function preencherBusca(nome: string) {
    setBusca(nome);
    setPagina(0);
    setSugestoesAbertas(false);
    setSugestaoAtiva(-1);
  }

  function navegarSugestoes(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && mostrarSugestoes) {
      e.preventDefault();
      setSugestoesAbertas(false);
      setSugestaoAtiva(-1);
    } else if (e.key === "Enter" && mostrarSugestoes && sugestoes[sugestaoAtiva]) {
      e.preventDefault();
      preencherBusca(sugestoes[sugestaoAtiva].nome);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && sugestoes.length) {
      e.preventDefault();
      setSugestoesAbertas(true);
      setSugestaoAtiva((indice) => {
        if (indice < 0) return e.key === "ArrowDown" ? 0 : sugestoes.length - 1;
        return (indice + (e.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
      });
    }
  }

  function indicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nome = nomeIndicado.trim().replace(/\s+/g, " ");
    const chave = (valor: string) => valor.normalize("NFD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (!aoIndicar || confirmando || selecionadas.length >= 3) return;
    if (chave(nome).length < 2) {
      setErroIndicacao("Informe o nome da empresa ou iniciativa.");
      return;
    }
    const existente = linhas.find((linha) => chave(linha.nome) === chave(nome) || chave(linha.razao_social ?? "") === chave(nome));
    if (selecionadas.some((linha) => linha.id === existente?.id || chave(linha.nome) === chave(nome))) {
      setErroIndicacao("Essa empresa já está na sua seleção.");
      return;
    }
    if (existente) escolher(existente);
    else {
      aoIndicar(nome);
      if (selecionados.length === 2) rolarParaAcoes();
    }
    setMostraIndicacao(false);
    setNomeIndicado("");
    setErroIndicacao("");
  }

  function rolarParaAcoes() {
    requestAnimationFrame(() => acoes.current?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    }));
  }

  function escolher(linha: RankingVoto) {
    const adicionando = !selecionados.includes(linha.id);
    const atingiu = adicionando && selecionados.length >= 3;
    setAtingiuLimite(atingiu);
    if (atingiu) return;
    aoEscolher(linha.id);
    if (adicionando && selecionados.length === 2) rolarParaAcoes();
  }

  return (
    <section id={areaId} aria-labelledby={tituloId} className="grid gap-5 border-t border-[#e6dfec] pt-6 scroll-mt-24">
      <h3 id={tituloId} className={mm.titulo + " mb-0 text-[#5c2686]"}>{categoria.nome}</h3>
      {aberta && selecionadas.length > 0 && <p className={mm.info}>
        Seleção nesta categoria: {selecionadas.map((linha) => linha.nome).join(", ")}
      </p>}
      <h4 className="font-bold">
        {confirmado ? "Classificação definitiva" : "Ranking popular"}
        {aberta && <span className="ml-2 text-sm font-normal text-[#62566f]">(vote abaixo)</span>}
      </h4>
      {aberta && <p role="status" className={atingiuLimite ? mm.info : mm.dica}>
        {atingiuLimite ? "Limite de 3 empresas. Remova uma seleção para escolher outra." : selecionados.length + " de 3 empresas selecionadas"}
      </p>}
      <p className={mm.dica}>{total.toLocaleString("pt-BR")} {total === 1 ? "voto" : "votos"} · {linhas.length} {linhas.length === 1 ? "empreendimento" : "empreendimentos"}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className={mm.rotulo + " relative flex-1 min-w-52"}>
          <div className="flex items-center gap-1">
            <label htmlFor={areaId + "-busca"}>Pesquisar empresa</label>
            {aberta && aoIndicar && <button type="button"
              className="inline-grid size-6 place-items-center rounded-full text-[#5c2686] hover:bg-[#f0e5f8] focus-visible:outline-2 focus-visible:outline-[#8054a5]"
              aria-label="Sobre adicionar uma empresa" aria-expanded={mostraAjuda}
              aria-controls={areaId + "-ajuda-indicacao"} onClick={() => setMostraAjuda((visivel) => !visivel)}>
              <Info aria-hidden="true" className="size-4" />
            </button>}
          </div>
          <input id={areaId + "-busca"} className={mm.campo} type="search" value={busca} autoComplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded={mostrarSugestoes}
            aria-controls={mostrarSugestoes ? sugestoesId : undefined}
            aria-activedescendant={mostrarSugestoes && sugestoes[sugestaoAtiva] ? sugestoesId + "-" + sugestaoAtiva : undefined}
            maxLength={150} placeholder="Nome da empresa, razão social ou nome do sócio"
            onFocus={() => setSugestoesAbertas(true)}
            onBlur={() => { setSugestoesAbertas(false); setSugestaoAtiva(-1); }}
            onKeyDown={navegarSugestoes}
            onChange={(e) => { setBusca(e.target.value); setPagina(0); setSugestoesAbertas(true); setSugestaoAtiva(-1); }} />
          {mostrarSugestoes && <ul id={sugestoesId} role="listbox" aria-label="Sugestões de empresas"
            className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white py-1 font-normal text-black shadow-lg">
            {sugestoes.map((linha, indice) => (
              <li key={linha.id} id={sugestoesId + "-" + indice} role="option"
                aria-selected={indice === sugestaoAtiva}
                className={"cursor-pointer break-words px-3 py-2 hover:bg-gray-100 " +
                  (indice === sugestaoAtiva ? "bg-gray-100" : "")}
                onMouseDown={(e) => e.preventDefault()} onClick={() => preencherBusca(linha.nome)}>
                <span className="block font-semibold">{linha.nome}</span>
                {linha.razao_social && linha.razao_social !== linha.nome &&
                  <span className="block text-sm">{linha.razao_social}</span>}
              </li>
            ))}
          </ul>}
        </div>
        {aberta && aoIndicar && (
          <button type="button" className={mm.botaoSecundario} aria-expanded={mostraIndicacao}
            onClick={() => setMostraIndicacao((visivel) => !visivel)}>Adicionar empresa</button>
        )}
      </div>
      {aberta && aoIndicar && <p id={areaId + "-ajuda-indicacao"} hidden={!mostraAjuda} className={mm.info}>
        Não encontrou a empresa ou iniciativa incentivadora em que gostaria de votar? Clique em Adicionar empresa
        e informe o nome. Ela entra no ranking quando você confirmar os votos.
      </p>}
      {aberta && aoIndicar && mostraIndicacao && (
        <form onSubmit={indicar} className={mm.info + " grid gap-3"}>
          <label className={mm.rotulo}>Nome da empresa ou iniciativa
            <input className={mm.campo} value={nomeIndicado} required maxLength={150}
              onChange={(e) => setNomeIndicado(e.target.value)} />
          </label>
          <label className={mm.marcar}>
            <input className={mm.checkbox} type="checkbox" required />
            Confirmo que é uma empresa ou iniciativa incentivadora.
          </label>
          <button className={mm.botao + " justify-self-start"} disabled={selecionadas.length >= 3 || confirmando}>Adicionar à seleção</button>
          {selecionadas.length >= 3 && <p className={mm.dica}>Remova uma empresa para abrir espaço na seleção.</p>}
          {erroIndicacao && <p role="alert" className={mm.erro}>{erroIndicacao}</p>}
        </form>
      )}
      {aberta && indicacoesLocais.length > 0 &&
        <RankingVotacao linhas={indicacoesLocais} selecionados={selecionados}
          aoVotar={confirmando ? undefined : escolher} />}
      {filtradas.length ? <>
        <RankingVotacao linhas={visiveis} selecionados={aberta ? selecionados : undefined}
          aoVotar={aberta && !confirmando ? escolher : undefined} />
        <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Paginação do ranking">
          <button type="button" className={mm.botaoSecundario} disabled={paginaAtual === 0}
            onClick={() => setPagina(paginaAtual - 1)}>‹ Página anterior</button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Empresas por página:
            <select className={mm.campo + " !w-auto"} value={limite}
              onChange={(e) => { setLimite(Number(e.target.value)); setPagina(0); }}>
              {[5, 10, 20, 50, 100].map((quantidade) => <option key={quantidade}>{quantidade}</option>)}
            </select>
          </label>
          <span role="status" className={mm.dica}>Página {paginaAtual + 1} de {paginas} · {filtradas.length} {filtradas.length === 1 ? "empresa" : "empresas"}</span>
          <button type="button" className={mm.botaoSecundario} disabled={paginaAtual + 1 >= paginas}
            onClick={() => setPagina(paginaAtual + 1)}>Próxima página ›</button>
        </nav>
      </> : <p role="status" className={mm.dica}>
        {busca.trim() ? "Nenhuma empresa encontrada para essa pesquisa." : "Nenhum empreendimento no ranking."}
      </p>}
      {children && <div ref={acoes}>{children}</div>}
    </section>
  );
}

function ConfirmacaoFinal({ evento, categorias, selecionadas, escolhasDoLink, email, aoAlterarEmail, aoRemover, aoEnviar, aoRegistrar, atualizar, voltar }: {
  evento: string;
  categorias: Votacao["categorias"];
  selecionadas: EscolhaVoto[];
  escolhasDoLink: string[];
  email: string;
  aoAlterarEmail(email: string): void;
  aoRemover(id: string): void;
  aoEnviar(enviando: boolean): void;
  aoRegistrar(ids: string[]): void;
  atualizar(): Promise<void>;
  voltar?: () => void;
}) {
  const [token, setToken] = useState("");
  const [verificacao, setVerificacao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: true; texto: string } | { erro: false; texto: string; link: string }>();
  const [retornoCopia, setRetornoCopia] = useState("");
  const temSelecao = selecionadas.length > 0;

  useEffect(() => {
    if (!temSelecao) setToken("");
  }, [temSelecao]);

  async function votar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !selecionadas.length || enviando) return;
    const concorrentes = selecionadas.filter((linha) => !linha.indicada).map((linha) => linha.id);
    const indicacoes = selecionadas.filter((linha) => linha.indicada).map(({ categoria_id, nome }) => ({ categoria_id, nome }));
    setEnviando(true);
    aoEnviar(true);
    setMensagem(undefined);
    setRetornoCopia("");
    try {
      const resposta = await fetch(API_VOTACAO_MM, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento, concorrentes, indicacoes, email, token }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível registrar os votos.");
      const link = new URL(ROTA_VOTACAO_MM, window.location.origin);
      const confirmadas: string[] = resultado.concorrentes ?? concorrentes;
      for (const id of confirmadas) link.searchParams.append("concorrente", id);
      link.hash = "votacao-revisao";
      setMensagem({
        erro: false,
        texto: confirmadas.length === 1 ? "Voto registrado." : confirmadas.length + " votos registrados.",
        link: link.href,
      });
      await atualizar();
      aoRegistrar(confirmadas);
    } catch (erro) {
      setMensagem({ erro: true, texto: (erro as Error).message });
    } finally {
      setToken("");
      setVerificacao((n) => n + 1);
      setEnviando(false);
      aoEnviar(false);
    }
  }

  async function copiarLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setRetornoCopia("Link copiado.");
    } catch {
      setRetornoCopia("Selecione e copie o endereço no campo acima.");
    }
  }

  return <div className="grid gap-3">
    <form id="confirmar-votos" onSubmit={votar} className="grid gap-3 scroll-mt-32">
      <h4 className="font-bold">Revise sua seleção</h4>
      {!temSelecao && <p className={mm.dica}>Use Voltar para selecionar uma empresa antes de confirmar.</p>}
      {selecionadas.some((linha) => escolhasDoLink.includes(linha.id)) && <p className={mm.dica}>
        O link trouxe as empresas pré-selecionadas. Revise a lista, informe seu e-mail e confirme.
      </p>}
      {!!selecionadas.length && <div className={mm.info + " grid gap-3"}>
        {categorias.map((categoria) => {
          const escolhas = selecionadas.filter((linha) => linha.categoria_id === categoria.id);
          if (!escolhas.length) return null;
          return <div key={categoria.id}>
            <p className="font-bold">{categoria.nome}</p>
            <ul className="grid gap-1">
              {escolhas.map((linha) => <li key={linha.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{linha.nome}</span>
                <button type="button" className="text-sm underline disabled:opacity-50" disabled={enviando}
                  aria-label={"Remover " + linha.nome} onClick={() => aoRemover(linha.id)}>Remover</button>
              </li>)}
            </ul>
          </div>;
        })}
      </div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className={mm.rotulo + " flex-1 max-w-xl"}>Seu e-mail
          <input className={mm.campo} type="email" autoComplete="email" maxLength={254} required
            value={email} onChange={(e) => aoAlterarEmail(e.target.value)} />
        </label>
        <button className={mm.botao + " self-start sm:min-h-[45px] sm:self-end"} disabled={!selecionadas.length || !token || enviando} type="submit">
          {enviando ? "Registrando…" : "Confirmar votos"}
        </button>
      </div>
      <p className={mm.dica}>Seu e-mail é usado para auditoria da votação e fica visível apenas à administração.</p>
      {selecionadas.length > 0 && <Verificacao key={verificacao} aoValidar={setToken} />}
    </form>
    {mensagem && (mensagem.erro
      ? <p role="alert" className={mm.falha}>{mensagem.texto}</p>
      : <div className={mm.sucesso + " grid gap-3"}>
        <p role="status">{mensagem.texto}</p>
        <p>Quer que outras pessoas votem nas mesmas empresas que você? Compartilhe sua seleção de todas as categorias em um único link.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className={mm.rotulo + " flex-1 min-w-52"}>Link para compartilhar
            <input className={mm.campo} type="url" readOnly value={mensagem.link}
              onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button type="button" className={mm.botaoSecundario}
            onClick={() => void copiarLink(mensagem.link)}>Copiar link</button>
        </div>
        {retornoCopia && <p role="status">{retornoCopia}</p>}
        <Link className={mm.botao + " justify-self-start"} href={ROTA_ACOMPANHAR_MM}>Acompanhar votação</Link>
      </div>)}
    {voltar && <button type="button" className={mm.botaoSecundario + " justify-self-center"}
      disabled={enviando} onClick={voltar}>Voltar</button>}
  </div>;
}
