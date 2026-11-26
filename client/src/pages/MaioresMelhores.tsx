import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Building2, ClipboardList, Handshake } from "lucide-react";
import { Link, Redirect } from "wouter";
import { MolduraMm, HeroMm } from "@/components/maiores-melhores/Moldura";
import { FormularioInscricao, type DadosInscricao } from "@/components/maiores-melhores/FormularioInscricao";
import { FormularioNegocio } from "@/components/maiores-melhores/FormularioNegocio";
import { ListaNegocios } from "@/components/maiores-melhores/ListaNegocios";
import { MinhaInscricao } from "@/components/maiores-melhores/MinhaInscricao";
import { ROTA_VOTACAO_MM, TITULO_VOTACAO_MM } from "@/lib/maioresMelhoresVotacao";
import { mm } from "@/components/maiores-melhores/estilo";
import {
  LegendaObrigatorios,
  MensagemErro,
  Obrigatorio,
  ResumoErros,
  ariaCampo,
  classeCampo,
  irParaPrimeiroErro,
  useErros,
} from "@/components/maiores-melhores/campos";
import { validarPrimeiroAcesso, validarRecuperacao } from "@/lib/validacao";
import { mascarar, mascaraCnpj, mascaraTelefone } from "@/lib/mascaras";
import {
  type MmEvento,
  type MmNegocio,
  formatarCnpj,
  formatarData,
  normalizarCnpj,
  situacaoPeriodo,
} from "@/lib/maioresMelhores";
import {
  ErroSessaoMm,
  type SessaoMm,
  lerTokenParticipante,
  limparTokenParticipante,
  mmApi,
  salvarTokenParticipante,
} from "@/lib/maioresMelhoresApi";

type Aba = "inscricao" | "negocio" | "historico";
type Mensagem = { ok: boolean; texto: string };

const ABAS: { id: Aba; titulo: string; tituloPainel: string; icone: typeof Building2 }[] = [
  { id: "inscricao", titulo: "Inscrição", tituloPainel: "Inscrição da empresa", icone: Building2 },
  { id: "negocio", titulo: "Registrar negócio", tituloPainel: "Registrar negócio", icone: Handshake },
  { id: "historico", titulo: "Meus negócios", tituloPainel: "Meus negócios", icone: ClipboardList },
];

export default function MaioresMelhores() {
  const { search, hash } = window.location;
  if (new URLSearchParams(search).has("concorrente") || /^#votacao(?:-|$)/.test(hash)) {
    return <Redirect to={ROTA_VOTACAO_MM + search + hash} replace />;
  }
  return <InscricoesMaioresMelhores />;
}

function InscricoesMaioresMelhores() {
  const [evento, setEvento] = useState<MmEvento | null>();
  const [erroEvento, setErroEvento] = useState("");
  const [token, setToken] = useState<string | null>(() => lerTokenParticipante());
  const [sessao, setSessao] = useState<SessaoMm | null>(null);
  const [aba, setAba] = useState<Aba>("inscricao");
  const [editando, setEditando] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>();
  const [ocupado, setOcupado] = useState(false);
  /** CNPJ informado em "Já inscreveu sua empresa?" sem inscrição: leva ao cadastro (vez muda a cada pedido). */
  const [semInscricao, setSemInscricao] = useState<{ cnpj: string; vez: number }>();
  const alvoResultado = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Maiores & Melhores no Empreendedorismo Negro | Diversidade.io";
    mmApi
      .eventoAtual()
      .then((e) => setEvento(e ?? null))
      .catch(() => {
        setEvento(null);
        setErroEvento("Não foi possível carregar a premiação. Atualize a página para tentar novamente.");
      });
  }, []);

  // Cada pessoa inscreve uma empresa só: para cadastrar outra, ela sai e começa um novo acesso.
  const sair = useCallback(() => {
    limparTokenParticipante();
    setToken(null);
    setSessao(null);
    setAba("inscricao");
    setEditando(false);
    setInicializado(false);
    setMensagem(undefined);
    setSemInscricao(undefined);
  }, []);

  const recarregar = useCallback(async () => {
    if (!token) return;
    try {
      setSessao(await mmApi.sessao(token));
    } catch (e) {
      if (e instanceof ErroSessaoMm) {
        sair();
        setMensagem({ ok: false, texto: e.message });
      } else {
        setMensagem({ ok: false, texto: (e as Error).message });
      }
    }
  }, [token, sair]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (mensagem) alvoResultado.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [mensagem]);

  // Ao voltar com a sessão guardada (ou pelo link do e-mail), quem já tem empresa abre em "Registrar negócio".
  // O conteúdo só aparece depois dessa decisão, para a aba errada não "piscar" na tela.
  const [inicializado, setInicializado] = useState(false);
  useEffect(() => {
    if (!sessao || evento === undefined || inicializado) return;
    setInicializado(true);
    if (sessao.empresas.length) setAba(evento?.aberto ? "negocio" : "historico");
  }, [sessao, evento, inicializado]);

  function trocarAba(proxima: Aba) {
    setAba(proxima);
    setEditando(false);
    setMensagem(undefined);
  }

  /** Executa uma ação do participante com estado de carregamento, mensagens e recarga da sessão. */
  async function executar<T>(acao: (token: string) => Promise<T>, sucesso: string): Promise<T | null> {
    if (ocupado || !token) return null;
    setOcupado(true);
    setMensagem(undefined);
    try {
      const resultado = await acao(token);
      await recarregar();
      setMensagem({ ok: true, texto: sucesso });
      return resultado;
    } catch (e) {
      if (e instanceof ErroSessaoMm) sair();
      setMensagem({ ok: false, texto: e instanceof Error ? e.message : "Não foi possível concluir a operação." });
      return null;
    } finally {
      setOcupado(false);
    }
  }

  /** Sobe a foto de cada sócio que enviou uma nova e liga cada arquivo ao sócio dono dele. */
  async function sociosParaEnvio(socios: DadosInscricao["socios"]) {
    return Promise.all(
      socios.map(async ({ foto, fotoMantida, ...socio }) => {
        if (foto) return { ...socio, foto_path: await mmApi.enviarFoto(foto), foto_autorizada: true };
        if (fotoMantida) return { ...socio, foto_mantida: fotoMantida };
        return socio;
      }),
    );
  }

  async function inscrever(dados: DadosInscricao) {
    const r = await executar(async (t) => {
      const { socios, ...resto } = dados;
      return mmApi.inscreverEmpresa(t, { ...resto, socios: await sociosParaEnvio(socios) });
    }, "Inscrição registrada! Agora registre o primeiro negócio desta empresa.");
    // Já segue para "Registrar negócio", na empresa recém-inscrita.
    if (r) setAba("negocio");
    return !!r;
  }

  async function salvarEdicao(dados: DadosInscricao) {
    const r = await executar(async (t) => {
      // O CNPJ de uma inscrição salva não muda: não vai na edição.
      const { socios, cnpj: _cnpj, ...resto } = dados;
      await mmApi.atualizarInscricao(t, { ...resto, socios: await sociosParaEnvio(socios) });
      return true;
    }, "Inscrição atualizada.");
    if (r) setEditando(false);
    return !!r;
  }

  async function registrarNegocio(dados: Record<string, unknown>, emailComprador: string) {
    // A plataforma envia o e-mail ao comprador. O link de confirmação nunca passa pelo participante.
    const r = await executar((t) => mmApi.registrarNegocio(t, dados), "Nota registrada.");
    if (r) {
      setMensagem({ ok: r.email_enviado, texto: textoDoEnvio("Nota registrada!", r.email_enviado, emailComprador) });
      setAba("historico"); // o negócio recém-lançado aparece na lista, aguardando a resposta do comprador
    }
    return !!r;
  }

  async function renovar(negocio: MmNegocio) {
    const r = await executar((t) => mmApi.renovarLink(t, negocio.id), "E-mail reenviado.");
    if (r) setMensagem({ ok: r.email_enviado, texto: textoDoEnvio("", r.email_enviado, negocio.email_comprador) });
  }

  const aberto = !!evento?.aberto;
  const empresa = sessao?.empresas[0];
  const periodo = evento ? `Inscrições de ${formatarData(evento.inicio_cadastro)} a ${formatarData(evento.fim_cadastro)}` : "";
  const tituloDoPainel = editando
    ? "Editar inscrição"
    : aba === "inscricao" && empresa
      ? "Minha inscrição"
      : ABAS.find((a) => a.id === aba)?.tituloPainel;

  const direitaCabecalho = token && sessao ? (
    <div className="flex items-center gap-3 flex-wrap text-sm">
      <span>Conectado como <strong>{sessao.participante.nome}</strong></span>
      <button type="button" className={mm.botaoSecundario} onClick={sair}>Sair</button>
    </div>
  ) : null;

  const botaoPremiacao = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#f5bf64] px-5 py-3 font-bold text-[#28123e] transition-colors hover:bg-[#ffd27f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5bf64]";

  return (
    <MolduraMm direita={direitaCabecalho}>
      <HeroMm
        sobrancelha={evento ? `Premiação ${evento.ano}` : "Premiação"}
        texto={evento?.descricao || "Inscreva sua empresa e registre os negócios que fortalecem o empreendedorismo negro."}
        detalhe={<div className="flex flex-col items-start gap-3">
          {evento && <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-sm text-[#f0e8f5]">
            {periodo}
          </span>}
          <div className="flex flex-wrap gap-3">
            <a className={botaoPremiacao} href="#inscricoes-desempenho">
              Votação por desempenho <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </a>
            <Link className={botaoPremiacao} href={ROTA_VOTACAO_MM}>
              {TITULO_VOTACAO_MM} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>}
      />

      <div id="inscricoes-desempenho" className="scroll-mt-6" tabIndex={-1} />
      {evento === undefined ? (
        <section className={mm.painel}><p role="status" className="m-0">Carregando a premiação…</p></section>
      ) : !evento ? (
        <AvisoSemEvento erro={erroEvento} />
      ) : !token ? (
        <div className="grid gap-5">
          <RecuperarAcesso
            inscricoesAbertas={aberto}
            aoNaoInscrita={(cnpj) => setSemInscricao((atual) => ({ cnpj, vez: (atual?.vez ?? 0) + 1 }))}
          />
          {aberto ? (
            <FormularioEntrada
              aoEntrar={(t) => {
                salvarTokenParticipante(t);
                setToken(t);
                setMensagem(undefined);
              }}
              mensagem={mensagem}
              semInscricao={semInscricao}
            />
          ) : (
            <AvisoPeriodo evento={evento} />
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-[230px_minmax(0,1fr)] gap-5 items-start">
          <nav className="bg-white border border-[#e6dfec] rounded-2xl p-2.5 flex flex-wrap md:grid gap-1" aria-label="Navegação da premiação">
            {ABAS.map(({ id, titulo, icone: Icone }) => (
              <button
                key={id}
                type="button"
                aria-current={aba === id ? "page" : undefined}
                onClick={() => trocarAba(id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 min-h-[42px] text-[0.92rem] font-bold text-left cursor-pointer ${
                  aba === id
                    ? "text-[#5c2686] bg-[#f2e8f8] border-[#e8d7f1]"
                    : "text-[#62566f] border-transparent hover:bg-[#f7f4fa] hover:text-[#5c2686]"
                }`}
              >
                <Icone size={19} /> {titulo}
              </button>
            ))}
          </nav>

          <section className={mm.painel}>
            <h2 className={mm.titulo}>{tituloDoPainel}</h2>

            <div ref={alvoResultado}>
              {mensagem && (
                <div className={mensagem.ok ? mm.sucesso : `${mm.falha} mb-4`} role={mensagem.ok ? "status" : "alert"}>
                  {mensagem.texto}
                </div>
              )}
            </div>

            {!sessao || !inicializado ? (
              <p role="status" className="m-0">Carregando inscrições…</p>
            ) : (
              <fieldset disabled={ocupado} aria-busy={ocupado} className="border-0 p-0 m-0 min-w-0">
                {aba !== "historico" && !aberto && <div className="mb-5"><AvisoPeriodo evento={evento} compacto /></div>}

                {aba === "inscricao" && (
                  empresa ? (
                    editando ? (
                      <FormularioInscricao
                        key={empresa.id}
                        empresa={empresa}
                        token={token}
                        temNegocios={sessao.negocios.some((n) => n.empresa_id === empresa.id)}
                        participante={sessao.participante}
                        aoSalvar={salvarEdicao}
                        aoErro={(texto) => setMensagem({ ok: false, texto })}
                        aoCancelar={() => setEditando(false)}
                      />
                    ) : (
                      <div className="grid gap-4">
                        <MinhaInscricao
                          empresa={empresa}
                          token={token}
                          totalNegocios={sessao.negocios.filter((n) => n.empresa_id === empresa.id).length}
                          aberto={aberto}
                          aoEditar={() => {
                            setMensagem(undefined);
                            setEditando(true);
                          }}
                          aoRegistrarNegocio={() => trocarAba("negocio")}
                          aoVerNegocios={() => trocarAba("historico")}
                        />
                        <OutraEmpresa aoSair={sair} />
                      </div>
                    )
                  ) : (
                    aberto && (
                      <FormularioInscricao
                        participante={sessao.participante}
                        aoSalvar={inscrever}
                        aoErro={(texto) => setMensagem({ ok: false, texto })}
                        cnpjInicial={semInscricao?.cnpj}
                      />
                    )
                  )
                )}

                {aba === "negocio" && aberto && (
                  empresa ? (
                    <FormularioNegocio empresa={empresa} aoSalvar={registrarNegocio} />
                  ) : (
                    <div className={mm.pilha}>
                      <p className="m-0">Para registrar negócios, primeiro inscreva a sua empresa.</p>
                      <div>
                        <button type="button" className={mm.botao} onClick={() => trocarAba("inscricao")}>Ir para a inscrição</button>
                      </div>
                    </div>
                  )
                )}

                {aba === "historico" && (
                  <>
                    {aberto && empresa && (
                      <div className="mb-4">
                        <button type="button" className={mm.botao} onClick={() => trocarAba("negocio")}>
                          <Handshake size={17} /> Registrar outro negócio
                        </button>
                      </div>
                    )}
                    <ListaNegocios
                      negocios={sessao.negocios}
                      empresas={sessao.empresas}
                      aoRenovar={(n) => void renovar(n)}
                      vazio="Você ainda não registrou negócios nesta edição."
                    />
                  </>
                )}
              </fieldset>
            )}
          </section>
        </div>
      )}
    </MolduraMm>
  );
}

/** Cada pessoa inscreve uma empresa só. Quem precisa de outra sai e começa um novo cadastro. */
function OutraEmpresa({ aoSair }: { aoSair: () => void }) {
  return (
    <div className={`${mm.cartao} bg-[#faf7fc] grid gap-2`}>
      <strong>Precisa inscrever outra empresa?</strong>
      <p className={mm.dica}>
        Cada pessoa inscreve uma empresa. Para cadastrar outra, saia e comece um novo cadastro com os dados dela. Esta inscrição
        continua salva: para voltar a ela depois, informe o CNPJ no começo da página e receba o link de acesso por e-mail.
      </p>
      <div>
        <button type="button" className={mm.botaoSecundario} onClick={aoSair}>Sair e inscrever outra empresa</button>
      </div>
    </div>
  );
}

type Aviso = { tipo: "ok" | "info" | "erro"; texto: string };

/**
 * Quem já se inscreveu informa só o CNPJ e recebe por e-mail um link para voltar à inscrição.
 * CNPJ sem inscrição nesta edição: avisa na hora e leva ao formulário de cadastro (aoNaoInscrita),
 * em vez de a pessoa ficar esperando um e-mail que não vai chegar.
 */
function RecuperarAcesso({ inscricoesAbertas, aoNaoInscrita }: { inscricoesAbertas: boolean; aoNaoInscrita: (cnpj: string) => void }) {
  const [cnpj, setCnpj] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>();
  const { erros, definir, limpar } = useErros();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const problemas = validarRecuperacao({ cnpj });
    definir(problemas);
    if (Object.keys(problemas).length) {
      setAviso(undefined);
      irParaPrimeiroErro(e.currentTarget);
      return;
    }
    setOcupado(true);
    setAviso(undefined);
    try {
      const normalizado = normalizarCnpj(cnpj);
      const resultado = await mmApi.solicitarAcesso(normalizado);
      if (resultado === "nao_inscrita") {
        setAviso({
          tipo: "info",
          texto: inscricoesAbertas
            ? "Não encontramos inscrição para este CNPJ nesta edição, então nenhum e-mail foi enviado. Faça a inscrição no formulário logo abaixo: primeiro seus dados, depois os da empresa."
            : "Não encontramos inscrição para este CNPJ nesta edição, e as inscrições estão encerradas.",
        });
        if (inscricoesAbertas) aoNaoInscrita(normalizado);
      } else if (resultado === "limitado") {
        setAviso({
          tipo: "info",
          texto:
            "Já enviamos um link de acesso para este CNPJ há pouco. Confira a caixa de entrada e o spam dos e-mails da inscrição. Se precisar de outro, peça novamente daqui a 1 minuto.",
        });
      } else {
        setAviso({
          tipo: "ok",
          texto:
            "Enviamos um link de acesso para os e-mails da inscrição (o do responsável e o de contato). O link vale por 30 minutos. Não chegou? Veja também a caixa de spam.",
        });
      }
    } catch (falha) {
      setAviso({ tipo: "erro", texto: falha instanceof Error ? falha.message : "Não foi possível enviar o link agora." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={mm.painel} aria-labelledby="titulo-recuperar-acesso">
      <h2 id="titulo-recuperar-acesso" className="text-[1.35rem] leading-tight font-bold mb-1">Já inscreveu sua empresa?</h2>
      <p className="mb-4 text-[#62566f]">
        Informe o CNPJ e enviamos um link de acesso por e-mail. Assim você volta a registrar negócios e a ver os que já lançou,
        em qualquer navegador.
      </p>
      <form className="flex flex-wrap items-start gap-3" onSubmit={enviar} noValidate>
        <label className={`${mm.rotulo} flex-1 min-w-[240px]`}>
          <span>CNPJ da empresa inscrita<Obrigatorio /></span>
          <input
            value={cnpj}
            onChange={(e) => {
              setCnpj(mascarar(e, mascaraCnpj));
              setAviso(undefined);
              limpar("cnpj");
            }}
            autoCapitalize="characters"
            maxLength={18}
            placeholder="00.000.000/0000-00"
            className={classeCampo(erros.cnpj)}
            {...ariaCampo("cnpj", erros.cnpj, true)}
          />
          <MensagemErro id="cnpj" erro={erros.cnpj} />
        </label>
        <button className={`${mm.botaoSecundario} sm:mt-[1.85rem]`} disabled={ocupado}>{ocupado ? "Enviando…" : "Receber link de acesso"}</button>
      </form>
      {aviso && (
        <p
          role={aviso.tipo === "erro" ? "alert" : "status"}
          className={`${aviso.tipo === "ok" ? mm.sucesso : aviso.tipo === "info" ? mm.info : mm.falha} mt-4 mb-0`}
        >
          {aviso.texto}
        </p>
      )}
    </section>
  );
}

function FormularioEntrada({
  aoEntrar,
  mensagem,
  semInscricao,
}: {
  aoEntrar: (token: string) => void;
  mensagem?: Mensagem;
  semInscricao?: { cnpj: string; vez: number };
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const { erros, definir, limpar } = useErros();
  const refSecao = useRef<HTMLElement>(null);
  const refNome = useRef<HTMLInputElement>(null);

  // CNPJ sem inscrição em "Já inscreveu sua empresa?": rola até aqui e já posiciona no primeiro campo.
  useEffect(() => {
    if (!semInscricao) return;
    refSecao.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    refNome.current?.focus({ preventScroll: true });
  }, [semInscricao]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const campos = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const problemas = validarPrimeiroAcesso({ nome: campos.nome ?? "", email: campos.email ?? "", telefone: campos.telefone ?? "" });
    definir(problemas);
    if (Object.keys(problemas).length) {
      setErro("");
      irParaPrimeiroErro(e.currentTarget);
      return;
    }
    setErro("");
    setOcupado(true);
    try {
      const r = await mmApi.entrar(campos.nome, campos.email, campos.telefone);
      aoEntrar(r.token);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível continuar.");
      setOcupado(false);
    }
  }

  return (
    <section ref={refSecao} className={`${mm.painel} scroll-mt-4`} aria-labelledby="titulo-entrada">
      <h2 id="titulo-entrada" className={mm.titulo}>Acesse o portal da premiação</h2>
      {semInscricao && (
        <p className={`${mm.info} mb-4`}>
          O CNPJ <strong>{formatarCnpj(semInscricao.cnpj)}</strong> ainda não tem inscrição nesta edição. Comece por aqui: informe
          seus dados e, na próxima etapa, os dados da empresa (o CNPJ já vai preenchido).
        </p>
      )}
      <p className="mb-4">Informe seu nome, e-mail e telefone para iniciar a inscrição.</p>
      {mensagem && !mensagem.ok && <p className={`${mm.falha} mb-4`} role="alert">{mensagem.texto}</p>}
      <form className={mm.pilha} onSubmit={enviar} noValidate>
        <LegendaObrigatorios />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className={mm.rotulo}>
            <span>Nome completo<Obrigatorio /></span>
            <input
              ref={refNome}
              name="nome"
              autoComplete="name"
              maxLength={180}
              className={classeCampo(erros.nome)}
              onChange={() => limpar("nome")}
              {...ariaCampo("nome", erros.nome, true)}
            />
            <MensagemErro id="nome" erro={erros.nome} />
          </label>
          <label className={mm.rotulo}>
            <span>E-mail<Obrigatorio /></span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={180}
              className={classeCampo(erros.email)}
              onChange={() => limpar("email")}
              {...ariaCampo("email", erros.email, true)}
            />
            <MensagemErro id="email" erro={erros.email} />
          </label>
          <label className={mm.rotulo}>
            <span>Telefone com DDD<Obrigatorio /></span>
            <input
              name="telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={15}
              placeholder="(00) 00000-0000"
              className={classeCampo(erros.telefone)}
              onChange={(e) => {
                mascarar(e, mascaraTelefone);
                limpar("telefone");
              }}
              {...ariaCampo("telefone", erros.telefone, true)}
            />
            <MensagemErro id="telefone" erro={erros.telefone} />
          </label>
        </div>
        <p className={mm.dica}>
          Este navegador fica salvo para você voltar direto. Se trocar de navegador ou de computador, informe o CNPJ da empresa no
          quadro acima para receber um link de acesso por e-mail.
        </p>
        {erro && <p className={mm.falha} role="alert">{erro}</p>}
        <ResumoErros erros={erros} />
        <div>
          <button className={mm.botao} disabled={ocupado}>{ocupado ? "Aguarde…" : "Continuar"}</button>
        </div>
      </form>
    </section>
  );
}

/** Mensagem após registrar/reenviar: diz se a plataforma conseguiu enviar o e-mail ao comprador. */
function textoDoEnvio(inicio: string, enviado: boolean, email: string) {
  const prefixo = inicio ? `${inicio} ` : "";
  return enviado
    ? `${prefixo}Enviamos um e-mail para ${email} com os dados da nota e o link para o comprador confirmar. Acompanhe a resposta aqui em "Meus negócios".`
    : `${prefixo}Não conseguimos enviar o e-mail para ${email} agora. Clique em "Reenviar e-mail ao comprador" na nota para tentar de novo.`;
}

function AvisoSemEvento({ erro }: { erro: string }) {
  return (
    <section className={`${mm.painel} max-w-[720px]`}>
      <h2 className={mm.titulo}>Inscrições fechadas</h2>
      <p>{erro || "No momento não há uma edição do Maiores & Melhores com inscrições abertas. Acompanhe a Diversidade.io para saber quando a próxima edição começar."}</p>
      <a href="/" className={mm.botaoSecundario}>Voltar para a Diversidade.io</a>
    </section>
  );
}

function AvisoPeriodo({ evento, compacto = false }: { evento: MmEvento; compacto?: boolean }) {
  const antes = !evento.aberto && situacaoPeriodo(evento) === "agendado";
  const texto = antes
    ? `As inscrições da edição ${evento.ano} começam em ${formatarData(evento.inicio_cadastro)}.`
    : `As inscrições da edição ${evento.ano} foram encerradas em ${formatarData(evento.fim_cadastro)}.`;
  if (compacto) return <p className={mm.vazio}>{texto}</p>;
  return (
    <section className={`${mm.painel} max-w-[720px]`}>
      <h2 className={mm.titulo}>{antes ? "Inscrições em breve" : "Inscrições encerradas"}</h2>
      <p>{texto}</p>
      <a href="/" className={mm.botaoSecundario}>Voltar para a Diversidade.io</a>
    </section>
  );
}
