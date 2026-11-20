import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, FileText, type LucideIcon, XCircle } from "lucide-react";
import { MolduraMm } from "@/components/maiores-melhores/Moldura";
import { mm } from "@/components/maiores-melhores/estilo";
import { MensagemErro, Obrigatorio, ResumoErros, ariaCampo, classeCampo, irParaPrimeiroErro, useErros } from "@/components/maiores-melhores/campos";
import { validarRespostaComprador } from "@/lib/validacao";
import { type RespostaComprador, formatarCnpj, formatarData, formatarMoeda } from "@/lib/maioresMelhores";
import { type NotaParaConfirmar, mmApi } from "@/lib/maioresMelhoresApi";
import { mascaraTelefone } from "@/lib/mascaras";

const OPCOES: { valor: RespostaComprador; rotulo: string; descricao: string; Icone: LucideIcon; cor: string }[] = [
  {
    valor: "confirmado",
    rotulo: "Confirmo os dados",
    descricao: "O negócio aconteceu e os dados da nota estão corretos.",
    Icone: CheckCircle2,
    cor: "text-[#205c39]",
  },
  {
    valor: "divergencia",
    rotulo: "Há divergência nos dados",
    descricao: "O negócio aconteceu, mas algo na nota não confere.",
    Icone: AlertTriangle,
    cor: "text-[#7a3f0c]",
  },
  {
    valor: "desconhecido",
    rotulo: "Não reconheço a operação",
    descricao: "Minha empresa não fez esse negócio.",
    Icone: XCircle,
    cor: "text-[#84243f]",
  },
];

/**
 * Página aberta pelo comprador a partir do link individual (token no fragmento #). Mostra quem pede a
 * confirmação e os dados da nota, e registra a resposta: confirma, aponta divergência ou não reconhece.
 */
export default function MaioresMelhoresConfirmar() {
  const [token, setToken] = useState("");
  const [nota, setNota] = useState<NotaParaConfirmar>();
  const [mensagem, setMensagem] = useState("");
  const [resposta, setResposta] = useState<RespostaComprador>();
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [concluido, setConcluido] = useState<RespostaComprador>();
  const { erros, definir, limpar } = useErros();

  useEffect(() => {
    document.title = "Confirmação de nota fiscal | Maiores & Melhores";
    const valor = window.location.hash.slice(1);
    setToken(valor);
    if (!/^[0-9a-f]{64}$/.test(valor)) {
      setMensagem("Abra o link completo que você recebeu por e-mail para consultar a nota.");
      return;
    }
    mmApi.confirmacaoObter(valor).then(setNota).catch((e: Error) => setMensagem(e.message));
  }, []);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const problemas = resposta ? validarRespostaComprador({ resposta, observacao }) : { resposta: "Escolha uma das respostas." };
    definir(problemas);
    if (!resposta || Object.keys(problemas).length) {
      setMensagem("");
      irParaPrimeiroErro(e.currentTarget);
      return;
    }
    setOcupado(true);
    setMensagem("");
    try {
      await mmApi.confirmacaoResponder(token, resposta, observacao);
      setConcluido(resposta);
      history.replaceState(null, "", window.location.pathname);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : "Não foi possível registrar a resposta.");
    } finally {
      setOcupado(false);
    }
  }

  const empresa = nota?.empresa;
  // Antes da migration 40 o banco não informa a empresa nem o papel dela: o texto fica genérico.
  const nomeEmpresa = empresa?.razao_social;
  const suaEmpresa = nota?.papel_inscrita === "comprador" ? nota.vendedora : nota?.papel_inscrita === "vendedor" ? nota.compradora : "";
  const escolhida = OPCOES.find((o) => o.valor === concluido);

  return (
    <MolduraMm>
      <section className={`${mm.painel} my-8 max-w-[760px] mx-auto`}>
        <p className={`${mm.sobrancelha} text-[#5c2686]`}>Maiores &amp; Melhores no Empreendedorismo Negro</p>
        <h1 className={mm.titulo}>Confirmação de nota fiscal</h1>

        {concluido && escolhida ? (
          <div role="status" className="grid gap-3 rounded-xl border border-[#b7dcc3] bg-[#e3f3e8] p-5 text-[#205c39]">
            <p className="m-0 flex items-center gap-2 text-lg font-bold">
              <CheckCircle2 size={22} aria-hidden="true" /> Resposta registrada. Obrigado!
            </p>
            <p className="m-0">
              Você respondeu <strong>“{escolhida.rotulo}”</strong>
              {nota && <> para a nota {nota.numero_nota}{nomeEmpresa && <> informada por <strong>{nomeEmpresa}</strong></>}</>}.
              A organização da premiação vai considerar a sua resposta na análise do negócio.
            </p>
            <p className="m-0 text-sm">Pode fechar esta página. O link já foi usado e não vale mais.</p>
          </div>
        ) : (
          <>
            {mensagem && <p role="alert" className={`${mm.falha} mb-4`}>{mensagem}</p>}
            {!mensagem && !nota && <p role="status">Carregando nota…</p>}
            {nota && (
              <form className={mm.pilha} onSubmit={enviar} noValidate>
                <p className="m-0 leading-relaxed">
                  {nomeEmpresa ? <>A empresa <strong>{nomeEmpresa}</strong></> : "Uma empresa"} está inscrita na premiação Maiores &amp;
                  Melhores no Empreendedorismo Negro e informou um negócio realizado com{" "}
                  {/* Sem repetir o ponto de nomes como "Varejo S.A." */}
                  {suaEmpresa ? <>a <strong>{suaEmpresa}</strong>{suaEmpresa.trim().endsWith(".") ? "" : "."}</> : "a sua empresa."} Confira os
                  dados abaixo e diga se o negócio aconteceu como descrito.
                </p>

                {empresa && (
                  <Bloco titulo="Empresa que solicita a confirmação" Icone={Building2}>
                    <Item rotulo="Razão social" valor={empresa.razao_social} />
                    <Item rotulo="CNPJ" valor={formatarCnpj(empresa.cnpj)} />
                    {(empresa.municipio || empresa.uf) && <Item rotulo="Cidade" valor={[empresa.municipio, empresa.uf].filter(Boolean).join("/")} />}
                    {empresa.responsavel && <Item rotulo="Responsável" valor={empresa.responsavel} />}
                    {empresa.email && (
                      <Item
                        rotulo="E-mail"
                        valor={<a href={`mailto:${empresa.email}`} className="text-[#5c2686] underline underline-offset-2 break-all">{empresa.email}</a>}
                      />
                    )}
                    {empresa.telefone && <Item rotulo="Telefone" valor={mascaraTelefone(empresa.telefone)} />}
                  </Bloco>
                )}

                <Bloco titulo="Dados da nota fiscal" Icone={FileText}>
                  <Item rotulo="Empresa compradora" valor={nota.compradora} detalhe={formatarCnpj(nota.cnpj_comprador)} />
                  <Item rotulo="Empresa vendedora" valor={nota.vendedora} detalhe={formatarCnpj(nota.cnpj_vendedor)} />
                  <Item rotulo="Número da nota" valor={nota.numero_nota + (nota.serie_nota ? ` · Série ${nota.serie_nota}` : "")} />
                  <Item rotulo="Data de emissão" valor={formatarData(nota.data_emissao)} />
                  <Item rotulo="Valor total" valor={<span className="text-lg">{formatarMoeda(nota.valor_centavos)}</span>} />
                </Bloco>

                <fieldset className="grid gap-3 m-0 p-0 border-0 min-w-0">
                  <legend className="font-bold text-lg mb-3">
                    Sua resposta
                    <Obrigatorio />
                  </legend>
                  {OPCOES.map(({ valor, rotulo, descricao, Icone, cor }, i) => {
                    const marcada = resposta === valor;
                    return (
                      <label
                        key={valor}
                        className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                          marcada
                            ? "border-[#5c2686] bg-[#f5f0f8]"
                            : erros.resposta
                              ? "border-[#d92d20] bg-white"
                              : "border-[#e6dfec] bg-white hover:border-[#cbb6dc]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="resposta"
                          value={valor}
                          checked={marcada}
                          onChange={() => {
                            setResposta(valor);
                            limpar("resposta", "observacao");
                          }}
                          className="mt-1 w-[18px] h-[18px] flex-none accent-[#5c2686]"
                          {...(i === 0 ? ariaCampo("resposta", erros.resposta, true) : {})}
                        />
                        <span className="grid gap-0.5 min-w-0">
                          <span className={`flex items-center gap-2 font-bold ${cor}`}>
                            <Icone size={18} aria-hidden="true" /> {rotulo}
                          </span>
                          <span className="text-sm text-[#62566f]">{descricao}</span>
                        </span>
                      </label>
                    );
                  })}
                  <MensagemErro id="resposta" erro={erros.resposta} />
                </fieldset>

                {resposta && resposta !== "confirmado" && (
                  <label className={mm.rotulo}>
                    {resposta === "divergencia" ? (
                      <span>O que não confere na nota?<Obrigatorio /></span>
                    ) : (
                      <span>Observação <span className="font-normal text-[#62566f]">(opcional)</span></span>
                    )}
                    <textarea
                      value={observacao}
                      onChange={(e) => {
                        setObservacao(e.target.value);
                        limpar("observacao");
                      }}
                      maxLength={350}
                      rows={3}
                      placeholder={resposta === "divergencia" ? "Ex.: o valor correto é R$ 12.000,00." : ""}
                      className={classeCampo(erros.observacao)}
                      {...ariaCampo("observacao", erros.observacao, resposta === "divergencia")}
                    />
                    <MensagemErro id="observacao" erro={erros.observacao} />
                  </label>
                )}

                <ResumoErros erros={erros} />
                <div className="grid gap-2">
                  <div>
                    <button className={mm.botao} disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar resposta"}</button>
                  </div>
                  <p className={mm.dica}>
                    A resposta só pode ser enviada uma vez{nota.expira_em ? `, até ${formatarData(nota.expira_em)}` : ""}. Não é preciso
                    cadastro nem senha.
                  </p>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </MolduraMm>
  );
}

function Bloco({ titulo, Icone, children }: { titulo: string; Icone: LucideIcon; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="m-0 flex items-center gap-2 text-[0.82rem] uppercase tracking-[0.08em] font-extrabold text-[#5c2686]">
        <Icone size={18} aria-hidden="true" /> {titulo}
      </h2>
      <div className={mm.cartao}>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 m-0">{children}</dl>
      </div>
    </section>
  );
}

function Item({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.85rem] text-[#62566f]">{rotulo}</dt>
      <dd className="m-0 font-semibold break-words">{valor}</dd>
      {detalhe && <dd className="m-0 text-sm text-[#62566f]">{detalhe}</dd>}
    </div>
  );
}
