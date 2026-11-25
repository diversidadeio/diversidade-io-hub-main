import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { dataVoto, filtrarRanking, ROTA_VOTACAO_MM, type CategoriaVoto, type ConfiguracaoVoto, type RankingVoto } from "@/lib/maioresMelhoresVotacao";
import { mm } from "./estilo";
import { RankingVotacao } from "./RankingVotacao";

interface Votacao extends ConfiguracaoVoto {
  aberta: boolean;
  categorias: Pick<CategoriaVoto, "id" | "nome">[];
  ranking: RankingVoto[];
}

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
const rota = "/api/maiores-melhores-votacao";

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
    let widget: { api: Turnstile; id: string } | undefined;
    void carregarTurnstile().then((api) => {
      if (!ativo || !alvo.current) return;
      const id = api.render(alvo.current, {
        sitekey: chave,
        action: "mm-voto",
        callback: aoValidar,
        "expired-callback": () => {
          aoValidar("");
          if (widget) api.reset(widget.id);
        },
        "error-callback": () => { aoValidar(""); setFalha(true); },
      });
      widget = { api, id };
    }).catch(() => { if (ativo) setFalha(true); });
    return () => {
      ativo = false;
      if (widget) widget.api.remove(widget.id);
    };
  }, [aoValidar, tentativa]);

  if (!chave) return <p className={mm.erro}>Verificação de segurança indisponível.</p>;
  return <div>
    <div ref={alvo} />
    {falha && <button type="button" className={mm.botaoSecundario} onClick={() => setTentativa((n) => n + 1)}>
      Recarregar verificação de segurança
    </button>}
  </div>;
}

async function lerVotacao(evento: string, signal?: AbortSignal): Promise<Votacao | null> {
  const resposta = await fetch(rota + "?evento=" + encodeURIComponent(evento), { signal });
  if (!resposta.ok) throw new Error("Não foi possível carregar a votação.");
  return resposta.json();
}

export default function VotacaoPublica({ evento }: { evento: string }) {
  const [dados, setDados] = useState<Votacao | null>();
  const [etapa, setEtapa] = useState<number>();
  const [email, setEmail] = useState("");
  const [escolhasDoLink] = useState(() =>
    [...new Set(new URLSearchParams(window.location.search).getAll("concorrente").map((id) => id.toLowerCase()))]
      .filter(Boolean).slice(0, 3));
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const requisicao = useRef<AbortController | undefined>(undefined);
  const secao = useRef<HTMLElement>(null);
  const carregada = !!dados;

  useEffect(() => {
    if (!carregada) return;
    const alvo = window.location.hash.slice(1);
    if (alvo === "votacao") secao.current?.scrollIntoView();
    else if (alvo.startsWith("votacao-")) secao.current?.scrollIntoView();
  }, [carregada]);

  const atualizar = useCallback(async () => {
    requisicao.current?.abort();
    const controller = new AbortController();
    requisicao.current = controller;
    try {
      const atual = await lerVotacao(evento, controller.signal);
      if (!controller.signal.aborted) {
        setDados(atual);
        setFalhaLeitura(false);
      }
    } catch {
      if (!controller.signal.aborted) setFalhaLeitura(true);
    }
  }, [evento]);

  useEffect(() => {
    void atualizar();
    const timer = window.setInterval(atualizar, 20000);
    return () => { window.clearInterval(timer); requisicao.current?.abort(); };
  }, [atualizar]);

  if (!dados) return <section className={mm.painel} aria-labelledby="votacao-titulo">
    <h2 id="votacao-titulo" className={mm.titulo}>Votação popular</h2>
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
  const atual = etapa ?? Math.max(0, inicio);
  const categoriaAtual = dados.categorias[atual];

  function irParaEtapa(indice: number) {
    setEtapa(indice);
    secao.current?.scrollIntoView();
  }

  return (
    <section id="votacao" ref={secao} className={mm.painel + " mb-6 scroll-mt-24"} aria-labelledby="votacao-titulo">
      <h2 id="votacao-titulo" className={mm.titulo}>Votação popular</h2>
      <div className="grid gap-5">
        <p className={mm.dica}>
          {confirmado ? "Resultado definitivo" : dados.aberta ? "Votação aberta" :
            dados.estado === "suspensa" ? "Votação suspensa" :
            agendada ? "Abertura em " + dataVoto.format(new Date(dados.inicio)) : "Votação encerrada"}
          {dados.aberta && " até " + dataVoto.format(new Date(Date.parse(dados.fim) - 1)) + " (horário de Brasília)"}
        </p>
        {falhaLeitura && <p role="status" className={mm.dica}>O ranking será atualizado na próxima consulta.</p>}
        {dados.aberta && etapas > 0 && (categoriaAtual ? (
          <AreaVotacao key={categoriaAtual.id} evento={evento} categoria={categoriaAtual}
            aberta confirmado={confirmado} escolhasDoLink={escolhasDoLink} email={email} aoMudarEmail={setEmail}
            linhas={dados.ranking.filter((linha) => linha.categoria_id === categoriaAtual.id)}
            atualizar={atualizar} passo={{ numero: atual + 1, total: etapas, avancar: () => irParaEtapa(atual + 1) }} />
        ) : (
          <div className={mm.info + " grid gap-3"}>
            <p role="status">Você chegou ao fim das categorias.</p>
            <button type="button" className={mm.botaoSecundario + " justify-self-start"}
              onClick={() => irParaEtapa(0)}>Voltar à primeira categoria</button>
          </div>
        ))}
        {!dados.aberta && dados.categorias.map((categoria) => (
          <AreaVotacao key={categoria.id} evento={evento} categoria={categoria}
            aberta={false} confirmado={confirmado} escolhasDoLink={escolhasDoLink} email={email} aoMudarEmail={setEmail}
            linhas={dados.ranking.filter((linha) => linha.categoria_id === categoria.id)}
            atualizar={atualizar} />
        ))}
      </div>
    </section>
  );
}

function AreaVotacao({ evento, categoria, aberta, confirmado, escolhasDoLink, email, aoMudarEmail, linhas, atualizar, passo }: {
  evento: string;
  categoria: Pick<CategoriaVoto, "id" | "nome">;
  aberta: boolean;
  confirmado: boolean;
  escolhasDoLink: string[];
  email: string;
  aoMudarEmail(email: string): void;
  linhas: RankingVoto[];
  atualizar(): Promise<void>;
  passo?: { numero: number; total: number; avancar(): void };
}) {
  const [escolhas, setEscolhas] = useState(escolhasDoLink);
  const [atingiuLimite, setAtingiuLimite] = useState(false);
  const [token, setToken] = useState("");
  const [verificacao, setVerificacao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: true; texto: string } | { erro: false; texto: string; link: string }>();
  const [retornoCopia, setRetornoCopia] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [limite, setLimite] = useState(10);
  const filtradas = filtrarRanking(linhas, busca);
  const paginas = Math.max(1, Math.ceil(filtradas.length / limite));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const inicioPagina = paginaAtual * limite;
  const visiveis = filtradas.slice(inicioPagina, inicioPagina + limite);
  const total = linhas.reduce((soma, linha) => soma + linha.votos, 0);

  const selecionadas = linhas.filter((linha) => escolhas.includes(linha.id));
  const selecionados = selecionadas.map((linha) => linha.id);
  const recebidasDoLink = selecionados.some((id) => escolhasDoLink.includes(id));

  function escolher(linha: RankingVoto) {
    if (enviando) return;
    if (!selecionados.includes(linha.id) && selecionados.length >= 3) {
      setAtingiuLimite(true);
      return;
    }
    setMensagem(undefined);
    setAtingiuLimite(false);
    if (selecionados.length === 1 && selecionados.includes(linha.id)) setToken("");
    setEscolhas(selecionados.includes(linha.id)
      ? selecionados.filter((id) => id !== linha.id)
      : [...selecionados, linha.id]);
  }

  async function votar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !selecionados.length || enviando) return;
    setEnviando(true);
    setMensagem(undefined);
    setRetornoCopia("");
    try {
      const resposta = await fetch(rota, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento, concorrentes: selecionados, email, token }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível registrar o voto.");
      const link = new URL(ROTA_VOTACAO_MM, window.location.origin);
      for (const id of selecionados) link.searchParams.append("concorrente", id);
      link.hash = areaId;
      setMensagem({
        erro: false,
        texto: selecionados.length === 1 ? "Voto registrado." : selecionados.length + " votos registrados.",
        link: link.href,
      });
      await atualizar();
    } catch (erro) {
      setMensagem({ erro: true, texto: (erro as Error).message });
    } finally {
      setToken("");
      setVerificacao((n) => n + 1);
      setEnviando(false);
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

  const areaId = "votacao-" + categoria.id;
  const tituloId = areaId + "-titulo";
  const formId = areaId + "-confirmar";

  return (
    <section id={areaId} aria-labelledby={tituloId} className="grid gap-5 border-t border-[#e6dfec] pt-6 scroll-mt-24">
      {passo && <p className={mm.dica}>Etapa {passo.numero} de {passo.total}</p>}
      <h3 id={tituloId} className={mm.titulo + " mb-0 text-[#5c2686]"}>{categoria.nome}</h3>
      {aberta && linhas.length > 0 && <form id={formId} onSubmit={votar} className="grid gap-3 scroll-mt-24">
        {recebidasDoLink && <p className={mm.dica}>
          O link já trouxe empresas selecionadas. Você pode manter ou alterar a seleção, informar seu e-mail e confirmar.
        </p>}
        <div className={mm.grade + " items-end"}>
          <div className={mm.info}>
            {selecionadas.length ? <ul className="grid gap-2" aria-label="Empresas selecionadas">
              {selecionadas.map((linha) => <li key={linha.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{linha.nome}</span>
                <button type="button" className="text-sm underline disabled:opacity-50" disabled={enviando}
                  aria-label={"Remover " + linha.nome} onClick={() => escolher(linha)}>Remover</button>
              </li>)}
            </ul> : <p>Escolha até 3 empresas no ranking para votar.</p>}
          </div>
          <label className={mm.rotulo}>Seu e-mail
            <input className={mm.campo} type="email" autoComplete="email" maxLength={254} required
              value={email} onChange={(e) => aoMudarEmail(e.target.value)} />
          </label>
        </div>
        <p className={mm.dica}>Seu e-mail é usado para auditoria da votação e fica visível apenas à administração.</p>
        {selecionados.length > 0 && <Verificacao key={verificacao} aoValidar={setToken} />}
        <div className="flex flex-wrap items-center gap-2">
          <button className={mm.botao} disabled={!selecionados.length || !token || enviando} type="submit">
            {enviando ? "Registrando…" : selecionados.length > 1 ? "Confirmar " + selecionados.length + " votos" : "Confirmar voto"}
          </button>
          {passo && mensagem?.erro !== false && <button type="button" className={mm.botaoSecundario}
            disabled={enviando} onClick={passo.avancar}>Pular categoria</button>}
        </div>
      </form>}
      {passo && linhas.length === 0 && <button type="button" className={mm.botaoSecundario + " justify-self-start"}
        onClick={passo.avancar}>Pular categoria</button>}
      {mensagem && (mensagem.erro
        ? <p role="alert" className={mm.falha}>{mensagem.texto}</p>
        : <div className={mm.sucesso + " grid gap-3"}>
          <p role="status">{mensagem.texto}</p>
          <p>Compartilhe sua seleção para outras pessoas votarem nas mesmas empresas.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className={mm.rotulo + " flex-1 min-w-52"}>Link para compartilhar
              <input className={mm.campo} type="url" readOnly value={mensagem.link}
                onFocus={(e) => e.currentTarget.select()} />
            </label>
            <button type="button" className={mm.botaoSecundario}
              onClick={() => void copiarLink(mensagem.link)}>Copiar link</button>
          </div>
          {retornoCopia && <p role="status">{retornoCopia}</p>}
          {passo && <button type="button" className={mm.botao + " justify-self-start"} onClick={passo.avancar}>
            {passo.numero === passo.total ? "Concluir votação" : "Próxima categoria"}
          </button>}
        </div>)}
      <h4 className="font-bold">{confirmado ? "Classificação definitiva" : "Ranking popular"}</h4>
      {aberta && <p role="status" className={atingiuLimite ? mm.info : mm.dica}>
        {atingiuLimite ? "Limite de 3 empresas. Remova uma seleção para escolher outra." : selecionados.length + " de 3 empresas selecionadas"}
      </p>}
      <p className={mm.dica}>{total.toLocaleString("pt-BR")} {total === 1 ? "voto" : "votos"} · {linhas.length} {linhas.length === 1 ? "empreendimento" : "empreendimentos"}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className={mm.rotulo + " flex-1 min-w-52"}>Pesquisar empresa
          <input className={mm.campo} type="search" value={busca} placeholder="Nome da empresa ou razão social"
            onChange={(e) => { setBusca(e.target.value); setPagina(0); }} />
        </label>
        <label className={mm.rotulo}>Empresas por página
          <select className={mm.campo} value={limite} onChange={(e) => { setLimite(Number(e.target.value)); setPagina(0); }}>
            {[10, 20, 50, 100].map((quantidade) => <option key={quantidade}>{quantidade}</option>)}
          </select>
        </label>
      </div>
      {filtradas.length ? <>
        <RankingVotacao linhas={visiveis} selecionados={selecionados} aoVotar={aberta ? escolher : undefined} />
        <nav className="flex flex-wrap items-center gap-3" aria-label="Paginação do ranking">
          <button type="button" className={mm.botaoSecundario} disabled={paginaAtual === 0}
            onClick={() => setPagina(paginaAtual - 1)}>‹ Anterior</button>
          <span role="status" className={mm.dica}>Página {paginaAtual + 1} de {paginas} · {filtradas.length} {filtradas.length === 1 ? "empresa" : "empresas"}</span>
          <button type="button" className={mm.botaoSecundario} disabled={paginaAtual + 1 >= paginas}
            onClick={() => setPagina(paginaAtual + 1)}>Próxima ›</button>
        </nav>
      </> : <p role="status" className={mm.dica}>
        {busca.trim() ? "Nenhuma empresa encontrada para essa pesquisa." : "Nenhum empreendimento no ranking."}
      </p>}
      {aberta && selecionados.length > 0 &&
        <a className={mm.botaoSecundario + " justify-self-start"} href={"#" + formId}>Ir para confirmação</a>}
    </section>
  );
}
