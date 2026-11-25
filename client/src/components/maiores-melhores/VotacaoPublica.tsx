import { useEffect, useRef, useState, type FormEvent } from "react";
import { dataVoto, filtrarRanking, type CategoriaVoto, type ConfiguracaoVoto, type RankingVoto } from "@/lib/maioresMelhoresVotacao";
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
  const [categoria, setCategoria] = useState("");
  const [escolhasDoLink] = useState(() =>
    [...new Set(new URLSearchParams(window.location.search).getAll("concorrente").map((id) => id.toLowerCase()))]
      .filter(Boolean).slice(0, 3));
  const [escolhas, setEscolhas] = useState(escolhasDoLink);
  const [atingiuLimite, setAtingiuLimite] = useState(false);
  const [email, setEmail] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [limite, setLimite] = useState(10);
  const [token, setToken] = useState("");
  const [verificacao, setVerificacao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: true; texto: string } | { erro: false; texto: string; link: string }>();
  const [retornoCopia, setRetornoCopia] = useState("");
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const requisicao = useRef<AbortController | undefined>(undefined);
  const secao = useRef<HTMLElement>(null);
  const carregada = !!dados;

  useEffect(() => {
    if (carregada && window.location.hash === "#votacao") secao.current?.scrollIntoView();
  }, [carregada]);

  useEffect(() => {
    async function atualizar() {
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
    }
    void atualizar();
    const timer = window.setInterval(atualizar, 20000);
    return () => { window.clearInterval(timer); requisicao.current?.abort(); };
  }, [evento]);

  const categoriaAtual = dados?.categorias.find((c) => c.id === categoria)
    ?? dados?.categorias.find((c) => c.id === dados.ranking.find((r) => escolhasDoLink.includes(r.id))?.categoria_id)
    ?? dados?.categorias[0];
  const linhas = dados?.ranking.filter((r) => r.categoria_id === categoriaAtual?.id) ?? [];
  const selecionadas = dados?.ranking.filter((linha) => escolhas.includes(linha.id)) ?? [];
  const selecionados = selecionadas.map((linha) => linha.id);
  const recebidasDoLink = selecionados.some((id) => escolhasDoLink.includes(id));
  const filtradas = filtrarRanking(linhas, busca);
  const paginas = Math.max(1, Math.ceil(filtradas.length / limite));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const inicioPagina = paginaAtual * limite;
  const visiveis = filtradas.slice(inicioPagina, inicioPagina + limite);

  function escolher(linha: RankingVoto) {
    if (enviando) return;
    if (!selecionados.includes(linha.id) && selecionados.length >= 3) {
      setAtingiuLimite(true);
      return;
    }
    setMensagem(undefined);
    setAtingiuLimite(false);
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
      const link = new URL("/maiores-e-melhores", window.location.origin);
      for (const id of selecionados) link.searchParams.append("concorrente", id);
      link.hash = "votacao";
      setMensagem({
        erro: false,
        texto: selecionados.length === 1 ? "Voto registrado." : selecionados.length + " votos registrados.",
        link: link.href,
      });
      requisicao.current?.abort();
      const controller = new AbortController();
      requisicao.current = controller;
      try {
        const atual = await lerVotacao(evento, controller.signal);
        if (!controller.signal.aborted) setDados(atual);
      } catch {
        if (!controller.signal.aborted) setFalhaLeitura(true);
      }
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

  if (!dados) return falhaLeitura && escolhasDoLink.length > 0
    ? <p className={mm.falha} role="alert">Não foi possível carregar a votação. A página tentará novamente.</p>
    : null;
  const confirmado = dados.estado === "publicada";
  const agendada = dados.estado === "ativa" && Date.now() < Date.parse(dados.inicio);
  const total = linhas.reduce((soma, linha) => soma + linha.votos, 0);

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
        {categoriaAtual && dados.categorias.length > 1 && <label className={mm.rotulo}>Categoria
          <select className={mm.campo} value={categoriaAtual.id} onChange={(e) => {
            setCategoria(e.target.value);
            setPagina(0);
          }}>
            {dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>}
        {dados.aberta && (linhas.length > 0 || selecionadas.length > 0) && <form onSubmit={votar} className="grid gap-3">
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
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <p className={mm.dica}>Seu e-mail é usado para auditoria da votação e fica visível apenas à administração.</p>
          <Verificacao key={verificacao} aoValidar={setToken} />
          <button className={mm.botao + " justify-self-start"} disabled={!selecionados.length || !token || enviando} type="submit">
            {enviando ? "Registrando…" : selecionados.length > 1 ? "Confirmar " + selecionados.length + " votos" : "Confirmar voto"}
          </button>
        </form>}
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
          </div>)}
        <h3 className="font-bold">{confirmado ? "Classificação definitiva" : "Ranking popular"}</h3>
        <p className={mm.dica}>{total.toLocaleString("pt-BR")} {total === 1 ? "voto" : "votos"} · {linhas.length} {linhas.length === 1 ? "empreendimento" : "empreendimentos"}</p>
        {dados.aberta && <p role="status" className={atingiuLimite ? mm.info : mm.dica}>
          {atingiuLimite ? "Limite de 3 empresas. Remova uma seleção para escolher outra." : selecionados.length + " de 3 empresas selecionadas"}
        </p>}
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
          <RankingVotacao linhas={visiveis} selecionados={selecionados} aoVotar={dados.aberta ? escolher : undefined} />
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
      </div>
    </section>
  );
}
