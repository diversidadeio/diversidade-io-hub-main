import { useEffect, useRef, useState, type FormEvent } from "react";
import { dataVoto, type CategoriaVoto, type ConfiguracaoVoto, type RankingVoto } from "@/lib/maioresMelhoresVotacao";
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
  const [concorrente, setConcorrente] = useState(() => new URLSearchParams(window.location.search).get("concorrente") || "");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [verificacao, setVerificacao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string }>();
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
    ?? dados?.categorias.find((c) => c.id === dados.ranking.find((r) => r.id === concorrente)?.categoria_id)
    ?? dados?.categorias[0];
  const linhas = dados?.ranking.filter((r) => r.categoria_id === categoriaAtual?.id) ?? [];
  const selecionado = linhas.some((r) => r.id === concorrente) ? concorrente : "";

  async function votar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !selecionado || enviando) return;
    setEnviando(true);
    setMensagem(undefined);
    try {
      const resposta = await fetch(rota, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento, concorrente: selecionado, email, token }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível registrar o voto.");
      setMensagem({ erro: false, texto: "Voto registrado." });
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

  if (!dados) return falhaLeitura && concorrente
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
        {categoriaAtual && <label className={mm.rotulo}>Categoria
          <select className={mm.campo} value={categoriaAtual.id} onChange={(e) => {
            setCategoria(e.target.value);
            setConcorrente("");
          }}>
            {dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>}
        {dados.aberta && linhas.length > 0 && <form onSubmit={votar} className="grid gap-3">
          <div className={mm.grade}>
            <label className={mm.rotulo}>Empreendimento
              <select className={mm.campo} value={selecionado} onChange={(e) => {
                setCategoria(categoriaAtual?.id ?? "");
                setConcorrente(e.target.value);
              }} required>
                <option value="">Selecione</option>
                {[...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((linha) =>
                  <option value={linha.id} key={linha.id}>{linha.nome}</option>)}
              </select>
            </label>
            <label className={mm.rotulo}>Seu e-mail
              <input className={mm.campo} type="email" autoComplete="email" maxLength={254} required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <p className={mm.dica}>Seu e-mail é usado para auditoria da votação e fica visível apenas à administração.</p>
          <Verificacao key={verificacao} aoValidar={setToken} />
          <button className={mm.botao + " justify-self-start"} disabled={!token || enviando} type="submit">
            {enviando ? "Registrando…" : "Confirmar voto"}
          </button>
        </form>}
        {mensagem && <p role={mensagem.erro ? "alert" : "status"} className={mensagem.erro ? mm.falha : mm.sucesso}>
          {mensagem.texto}
        </p>}
        <h3 className="font-bold">{confirmado ? "Classificação definitiva" : "Ranking popular"}</h3>
        <p className={mm.dica}>{total.toLocaleString("pt-BR")} votos na categoria · {linhas.length} concorrentes</p>
        <RankingVotacao linhas={linhas} />
      </div>
    </section>
  );
}
