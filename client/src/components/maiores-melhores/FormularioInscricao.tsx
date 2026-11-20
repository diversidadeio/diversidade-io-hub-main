import { type FormEvent, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  CATEGORIAS,
  DECLARACOES,
  PORTES,
  PORTES_INCLUSIVA,
  UFS,
  type Categoria,
  type Declaracao,
  type MmEmpresa,
  type MmSocio,
  cnpjValido,
  formatarCnpj,
  normalizarCnpj,
} from "@/lib/maioresMelhores";
import { ErroConsultaCnpj, consultarCnpj } from "@/lib/consultaCnpj";
import { mascarar, mascaraCnpj } from "@/lib/mascaras";
import { nomeOficialMunicipio, nomeProprio } from "@/lib/municipios";
import { prepararFotoRosto } from "@/lib/prepararFotoRosto";
import { validarInscricao } from "@/lib/validacao";
import {
  LegendaObrigatorios,
  MensagemErro,
  Obrigatorio,
  ResumoErros,
  ariaCampo,
  classeCampo,
  irParaPrimeiroErro,
  useErros,
} from "./campos";
import { mm } from "./estilo";
import { FotoDoSocio } from "./MinhaInscricao";

/** Um sócio ou titular na tela, com o estado da foto dele. */
type Linha = {
  id: number;
  nome: string;
  declaracao: Declaracao;
  foto?: File;
  autorizada: boolean;
  preparando: boolean;
  erroFoto: string;
  /** Edição: identificador da foto que o sócio já tem salva, e a posição dele na lista salva. */
  fotoAtualId?: string;
  indiceOriginal?: number;
  /** Edição: a foto atual será removida ao salvar. */
  fotoRemovida: boolean;
};

const novaLinha = (id: number): Linha => ({ id, nome: "", declaracao: "nao_informada", autorizada: false, preparando: false, erroFoto: "", fotoRemovida: false });
const linhaDeSocio = (socio: MmSocio, indice: number, id: number): Linha => ({
  ...novaLinha(id),
  nome: socio.nome,
  declaracao: socio.declaracao,
  fotoAtualId: socio.foto_id ?? undefined,
  indiceOriginal: socio.foto_id ? indice : undefined,
});
const semFoto = { foto: undefined, autorizada: false, preparando: false, erroFoto: "" };

export interface SocioEnvio {
  nome: string;
  declaracao: Declaracao;
  /** Foto opcional deste sócio, já com a autorização confirmada. */
  foto?: File;
  /** Edição: mantém a foto que o sócio já tem (identificador da foto). */
  fotoMantida?: string;
}

export interface DadosInscricao {
  categoria: Categoria;
  porte: string;
  razao_social: string;
  cnpj: string;
  responsavel: string;
  email: string;
  municipio: string;
  uf: string;
  /** Na categoria afro, o primeiro item é sempre o responsável pela inscrição. */
  socios: SocioEnvio[];
  consentimento: boolean;
}

interface Props {
  participante: { nome: string; email: string };
  /** Edição: a inscrição já salva. Sem ela, o formulário cria uma inscrição nova. */
  empresa?: MmEmpresa;
  /** Edição: token do participante, para mostrar as fotos atuais. */
  token?: string;
  /** Edição: com negócios registrados a categoria não pode mais mudar. */
  temNegocios?: boolean;
  aoSalvar: (dados: DadosInscricao) => Promise<boolean>;
  aoErro: (mensagem: string) => void;
  aoCancelar?: () => void;
}

export function FormularioInscricao({ participante, empresa, token, temNegocios = false, aoSalvar, aoErro, aoCancelar }: Props) {
  const edicao = !!empresa;
  const [categoria, setCategoria] = useState<Categoria>(empresa?.categoria ?? "afro");
  const [responsavel, setResponsavel] = useState(empresa?.responsavel ?? participante.nome);
  // Afro: o responsável é o 1º sócio ("principal") e "outros" são os demais.
  // Inclusiva: só existe a lista "outros", sem vínculo com o responsável e sem foto.
  const [principal, setPrincipal] = useState<Linha>(() =>
    empresa && empresa.categoria === "afro" && empresa.socios[0] ? linhaDeSocio(empresa.socios[0], 0, 0) : novaLinha(0),
  );
  const [outros, setOutros] = useState<Linha[]>(() =>
    empresa ? empresa.socios.map((socio, i) => linhaDeSocio(socio, i, i + 1)).slice(empresa.categoria === "afro" ? 1 : 0) : [],
  );
  const [proximoId, setProximoId] = useState(() => (empresa ? empresa.socios.length + 1 : 1));
  const [chaveFormulario, setChaveFormulario] = useState(0);
  const afro = categoria === "afro";
  const { erros, definir, limpar } = useErros();

  // Busca automática dos dados do CNPJ (município, UF e, se vazia, a razão social)
  const [statusCnpj, setStatusCnpj] = useState<{ tipo: "buscando" | "ok" | "aviso" | "erro"; texto: string }>();
  const refRazao = useRef<HTMLInputElement>(null);
  const refMunicipio = useRef<HTMLInputElement>(null);
  const refUf = useRef<HTMLSelectElement>(null);
  const ultimoCnpj = useRef("");
  const pedidoCnpj = useRef(0);

  async function buscarDadosCnpj(valor: string) {
    if (edicao) return; // o CNPJ de uma inscrição salva não muda
    const normalizado = normalizarCnpj(valor);
    if (normalizado.length !== 14) {
      pedidoCnpj.current++;
      ultimoCnpj.current = "";
      setStatusCnpj(undefined);
      return;
    }
    if (normalizado === ultimoCnpj.current) return;
    ultimoCnpj.current = normalizado;
    const pedido = ++pedidoCnpj.current;

    if (!cnpjValido(normalizado)) {
      setStatusCnpj({ tipo: "erro", texto: "Confira os dígitos do CNPJ." });
      return;
    }
    if (!/^\d{14}$/.test(normalizado)) {
      setStatusCnpj({ tipo: "aviso", texto: "CNPJ alfanumérico: preencha o município e a UF." });
      return;
    }

    setStatusCnpj({ tipo: "buscando", texto: "Buscando dados do CNPJ…" });
    try {
      const dados = await consultarCnpj(normalizado);
      const uf = dados.uf?.trim().toUpperCase() ?? "";
      const ufValida = UFS.includes(uf);
      const municipio = dados.municipio?.trim()
        ? ufValida
          ? await nomeOficialMunicipio(uf, dados.municipio)
          : nomeProprio(dados.municipio)
        : "";
      if (pedido !== pedidoCnpj.current) return;

      if (municipio && refMunicipio.current) refMunicipio.current.value = municipio;
      if (ufValida && refUf.current) refUf.current.value = uf;
      if (dados.razao_social && refRazao.current && !refRazao.current.value.trim()) refRazao.current.value = dados.razao_social.trim();
      limpar("municipio", "uf", "razao_social");

      setStatusCnpj(
        municipio || ufValida
          ? { tipo: "ok", texto: "Município e UF preenchidos pelo CNPJ. Confira antes de salvar." }
          : { tipo: "aviso", texto: "Não encontramos o endereço deste CNPJ. Preencha o município e a UF." },
      );
    } catch (erro) {
      if (pedido !== pedidoCnpj.current) return;
      if (erro instanceof ErroConsultaCnpj && erro.motivo === "NAO_ENCONTRADO") {
        setStatusCnpj({ tipo: "aviso", texto: "CNPJ não encontrado na Receita Federal. Confira o número ou preencha manualmente." });
      } else {
        ultimoCnpj.current = ""; // permite tentar de novo ao sair do campo ou redigitar
        setStatusCnpj({ tipo: "aviso", texto: "Não foi possível buscar os dados agora. Preencha o município e a UF." });
      }
    }
  }

  const atualizarOutro = (id: number, patch: Partial<Linha>) =>
    setOutros((linhas) => linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  function trocarCategoria(nova: Categoria) {
    if (nova === categoria) return;
    setCategoria(nova);
    limpar("porte", "socios");
    // Foto só existe para Afroempreendedores: ao sair da categoria, descarta as novas e marca as atuais
    // para remoção; ao voltar para ela antes de salvar, as atuais são mantidas de novo.
    const semFotoNova = (l: Linha): Linha => ({ ...l, ...semFoto, fotoRemovida: nova === "inclusiva" ? !!l.fotoAtualId : false });
    setPrincipal(semFotoNova);
    setOutros((linhas) => linhas.map(semFotoNova));
  }

  /** Quando a pessoa mexe num sócio, o erro daquele campo sai. */
  const aoMudarLinha = (id: number, patch: Partial<Linha>) => {
    if ("nome" in patch) limpar(`socio:${id}`);
    if ("declaracao" in patch) limpar("socios");
    if ("autorizada" in patch || "foto" in patch) limpar(`autorizacao:${id}`);
  };

  const linhasAtivas = afro ? [principal, ...outros] : outros;
  const fotoPendente = afro && linhasAtivas.some((l) => l.preparando || !!l.erroFoto);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (fotoPendente) return;
    const form = e.currentTarget;
    const campos = Object.fromEntries(new FormData(form)) as Record<string, string>;

    const lista = afro ? [{ ...principal, nome: responsavel }, ...outros] : outros;
    // Mostra de uma vez tudo o que falta: cada campo fica vermelho, com a mensagem embaixo.
    const problemas = validarInscricao({
      edicao,
      categoria,
      porte: campos.porte ?? "",
      razao_social: campos.razao_social ?? "",
      cnpj: campos.cnpj ?? "",
      responsavel,
      email: campos.email ?? "",
      municipio: campos.municipio ?? "",
      uf: campos.uf ?? "",
      consentimento: campos.consentimento === "on",
      socios: lista.map((l) => ({
        chave: l.id,
        nome: l.nome,
        declaracao: l.declaracao,
        temFotoNova: afro && !!l.foto,
        autorizouFoto: l.autorizada,
        ehResponsavel: afro && l.id === principal.id,
      })),
    });
    definir(problemas);
    if (Object.keys(problemas).length) {
      irParaPrimeiroErro(form);
      return;
    }

    const ok = await aoSalvar({
      categoria,
      porte: campos.porte,
      razao_social: campos.razao_social,
      cnpj: normalizarCnpj(campos.cnpj),
      responsavel: responsavel.trim(),
      email: campos.email,
      municipio: campos.municipio,
      uf: campos.uf,
      socios: lista.map((l) => ({
        nome: l.nome.trim(),
        declaracao: l.declaracao,
        foto: afro ? l.foto : undefined,
        fotoMantida: afro && !l.foto && l.fotoAtualId && !l.fotoRemovida ? l.fotoAtualId : undefined,
      })),
      consentimento: campos.consentimento === "on",
    });
    if (ok && !edicao) {
      definir({});
      form.reset();
      pedidoCnpj.current++;
      ultimoCnpj.current = "";
      setStatusCnpj(undefined);
      setResponsavel(participante.nome);
      setPrincipal(novaLinha(proximoId));
      setOutros([]);
      setProximoId((n) => n + 1);
      setChaveFormulario((n) => n + 1);
    }
  }

  const portes = afro ? PORTES : PORTES_INCLUSIVA;

  return (
    <form key={chaveFormulario} onSubmit={enviar} className={mm.pilha} noValidate>
      <LegendaObrigatorios />
      <div className={mm.grade}>
        <label className={mm.rotulo}>
          Categoria
          <select
            className={mm.campo}
            value={categoria}
            disabled={edicao && temNegocios}
            onChange={(e) => trocarCategoria(e.target.value as Categoria)}
          >
            {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
          {edicao && temNegocios && <small className="font-normal text-[#62566f]">A categoria não muda depois de registrar negócios.</small>}
        </label>
        <label className={mm.rotulo}>
          <span>Porte<Obrigatorio /></span>
          <select
            key={categoria}
            name="porte"
            className={classeCampo(erros.porte)}
            defaultValue={empresa && portes.includes(empresa.porte) ? empresa.porte : ""}
            onChange={() => limpar("porte")}
            {...ariaCampo("porte", erros.porte, true)}
          >
            <option value="">Selecione</option>
            {portes.map((p) => <option key={p}>{p}</option>)}
          </select>
          <MensagemErro id="porte" erro={erros.porte} />
        </label>
        <label className={mm.rotulo}>
          <span>Razão social<Obrigatorio /></span>
          <input
            ref={refRazao}
            name="razao_social"
            maxLength={180}
            defaultValue={empresa?.razao_social}
            className={classeCampo(erros.razao_social)}
            onChange={() => limpar("razao_social")}
            {...ariaCampo("razao_social", erros.razao_social, true)}
          />
          <MensagemErro id="razao_social" erro={erros.razao_social} />
        </label>
        <label className={mm.rotulo}>
          <span>CNPJ da empresa<Obrigatorio /></span>
          <input
            name="cnpj"
            readOnly={edicao}
            defaultValue={empresa ? formatarCnpj(empresa.cnpj) : undefined}
            placeholder="00.000.000/0000-00"
            maxLength={18}
            autoCapitalize="characters"
            className={`${classeCampo(erros.cnpj)} ${edicao ? mm.campoLeitura : ""}`}
            onChange={(e) => {
              limpar("cnpj");
              void buscarDadosCnpj(mascarar(e, mascaraCnpj));
            }}
            onBlur={(e) => void buscarDadosCnpj(e.currentTarget.value)}
            {...ariaCampo("cnpj", erros.cnpj, true)}
            aria-describedby={erros.cnpj ? "erro-cnpj status-cnpj" : "status-cnpj"}
          />
          <MensagemErro id="cnpj" erro={erros.cnpj} />
          {edicao && <small className="font-normal text-[#62566f]">O CNPJ não pode ser alterado. Para corrigi-lo, fale com a organização.</small>}
          <small
            id="status-cnpj"
            role="status"
            className={`font-normal ${
              statusCnpj?.tipo === "ok" ? "text-[#205c39]" : statusCnpj?.tipo === "erro" ? "text-[#84243f]" : statusCnpj?.tipo === "aviso" ? "text-[#754314]" : "text-[#62566f]"
            }`}
          >
            {statusCnpj?.texto}
          </small>
        </label>
        <label className={mm.rotulo}>
          <span>Responsável pela inscrição<Obrigatorio /></span>
          <input
            name="responsavel"
            maxLength={180}
            value={responsavel}
            onChange={(e) => {
              setResponsavel(e.target.value);
              limpar("responsavel");
            }}
            className={classeCampo(erros.responsavel)}
            {...ariaCampo("responsavel", erros.responsavel, true)}
          />
          <MensagemErro id="responsavel" erro={erros.responsavel} />
        </label>
        <label className={mm.rotulo}>
          <span>E-mail de contato<Obrigatorio /></span>
          <input
            name="email"
            type="email"
            maxLength={180}
            defaultValue={empresa?.email ?? participante.email}
            className={classeCampo(erros.email)}
            onChange={() => limpar("email")}
            {...ariaCampo("email", erros.email, true)}
          />
          <MensagemErro id="email" erro={erros.email} />
        </label>
        <label className={mm.rotulo}>
          <span>Município<Obrigatorio /></span>
          <input
            ref={refMunicipio}
            name="municipio"
            maxLength={180}
            defaultValue={empresa?.municipio}
            className={classeCampo(erros.municipio)}
            onChange={() => limpar("municipio")}
            {...ariaCampo("municipio", erros.municipio, true)}
          />
          <MensagemErro id="municipio" erro={erros.municipio} />
        </label>
        <label className={mm.rotulo}>
          <span>UF<Obrigatorio /></span>
          <select
            ref={refUf}
            name="uf"
            className={classeCampo(erros.uf)}
            defaultValue={empresa?.uf ?? ""}
            onChange={() => limpar("uf")}
            {...ariaCampo("uf", erros.uf, true)}
          >
            <option value="">Selecione</option>
            {UFS.map((uf) => <option key={uf}>{uf}</option>)}
          </select>
          <MensagemErro id="uf" erro={erros.uf} />
        </label>
      </div>

      <fieldset className={erros.socios ? mm.conjuntoErro : mm.conjunto}>
        <legend className={mm.legenda}>Sócios e titulares</legend>
        {afro ? (
          <p className={mm.dica}>
            O responsável pela inscrição é o 1º sócio ou titular. Informe a autodeclaração dele e, se desejar, envie a foto do
            rosto. Se houver outros sócios, adicione-os abaixo: cada um tem a sua autodeclaração e, se desejar, a sua foto, sempre
            com a autorização de quem aparece nela. Informe pelo menos um sócio ou titular autodeclarado preto ou pardo.
          </p>
        ) : (
          <p className={mm.dica}>
            Registre a autodeclaração informada por cada pessoa. Use “Não informada” quando a pessoa não tiver declarado.
            Nesta categoria a lista é opcional.
          </p>
        )}
        <div className="mt-2"><MensagemErro id="socios" erro={erros.socios} /></div>

        <div className="grid gap-4 my-4">
          {afro && (
            <CartaoSocio
              posicao={1}
              nomeFixo={responsavel}
              linha={principal}
              comFoto
              token={token}
              empresaId={empresa?.id}
              declaracaoComErro={!!erros.socios}
              erroAutorizacao={erros[`autorizacao:${principal.id}`]}
              atualizar={(patch) => {
                setPrincipal((l) => ({ ...l, ...patch }));
                aoMudarLinha(principal.id, patch);
              }}
            />
          )}
          {outros.map((linha, i) => (
            <CartaoSocio
              key={linha.id}
              posicao={(afro ? 2 : 1) + i}
              linha={linha}
              comFoto={afro}
              token={token}
              empresaId={empresa?.id}
              declaracaoComErro={!!erros.socios}
              erroNome={erros[`socio:${linha.id}`]}
              erroAutorizacao={erros[`autorizacao:${linha.id}`]}
              atualizar={(patch) => {
                atualizarOutro(linha.id, patch);
                aoMudarLinha(linha.id, patch);
              }}
              remover={() => {
                setOutros((linhas) => linhas.filter((l) => l.id !== linha.id));
                limpar(`socio:${linha.id}`, `autorizacao:${linha.id}`);
              }}
            />
          ))}
        </div>

        <button
          type="button"
          className={mm.botaoSecundario}
          disabled={outros.length >= (afro ? 99 : 100)}
          onClick={() => {
            setOutros((linhas) => [...linhas, novaLinha(proximoId)]);
            setProximoId((n) => n + 1);
          }}
        >
          <Plus size={17} /> Adicionar sócio
        </button>
      </fieldset>

      <div className="grid gap-1.5">
        <label className={mm.marcar}>
          <input
            type="checkbox"
            name="consentimento"
            className={`${mm.checkbox} ${erros.consentimento ? mm.checkboxErro : ""}`}
            onChange={() => limpar("consentimento")}
            {...ariaCampo("consentimento", erros.consentimento, true)}
          />
          <span>
            Confirmo que as informações são verdadeiras e que tenho autorização para compartilhar as autodeclarações informadas
            à organização para fins de apuração da premiação.<Obrigatorio />
          </span>
        </label>
        <MensagemErro id="consentimento" erro={erros.consentimento} />
      </div>
      <ResumoErros erros={erros} />
      <div className="flex flex-wrap gap-2">
        <button className={mm.botao} disabled={fotoPendente}>{edicao ? "Salvar alterações" : "Salvar inscrição"}</button>
        {edicao && aoCancelar && (
          <button type="button" className={mm.botaoSecundario} onClick={aoCancelar}>Cancelar</button>
        )}
      </div>
    </form>
  );
}

interface CartaoProps {
  posicao: number;
  linha: Linha;
  /** Presente no 1º sócio da categoria afro: o nome vem do campo "Responsável pela inscrição". */
  nomeFixo?: string;
  comFoto: boolean;
  token?: string;
  empresaId?: string;
  /** Erros de validação: nome do sócio, autodeclaração (nenhum sócio preto ou pardo) e autorização da foto. */
  erroNome?: string;
  declaracaoComErro?: boolean;
  erroAutorizacao?: string;
  atualizar: (patch: Partial<Linha>) => void;
  remover?: () => void;
}

function CartaoSocio({ posicao, linha, nomeFixo, comFoto, token, empresaId, erroNome, declaracaoComErro, erroAutorizacao, atualizar, remover }: CartaoProps) {
  const responsavel = nomeFixo !== undefined;
  return (
    <div className={`${mm.cartao} grid gap-4`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <strong>{posicao}º sócio ou titular</strong>
          {responsavel && (
            <span className="rounded-full bg-[#f2e8f8] px-2.5 py-0.5 text-xs font-bold text-[#5c2686]">Responsável pela inscrição</span>
          )}
        </div>
        {remover && (
          <button type="button" className={`${mm.botaoSecundario} px-2.5`} aria-label={`Remover o ${posicao}º sócio`} onClick={remover}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className={mm.grade}>
        <label className={mm.rotulo}>
          <span>Nome do sócio ou titular{!responsavel && <Obrigatorio />}</span>
          {responsavel ? (
            <>
              <input
                readOnly
                value={nomeFixo}
                placeholder="Informe o responsável pela inscrição acima"
                className={`${mm.campo} ${mm.campoLeitura}`}
              />
              <small className="font-normal text-[#62566f]">Vem do campo “Responsável pela inscrição”.</small>
            </>
          ) : (
            <>
              <input
                value={linha.nome}
                maxLength={180}
                className={classeCampo(erroNome)}
                onChange={(e) => atualizar({ nome: e.target.value })}
                {...ariaCampo(`socio-${linha.id}`, erroNome, true)}
              />
              <MensagemErro id={`socio-${linha.id}`} erro={erroNome} />
            </>
          )}
        </label>
        <label className={mm.rotulo}>
          Autodeclaração racial
          <select
            value={linha.declaracao}
            className={declaracaoComErro ? mm.campoErro : mm.campo}
            aria-invalid={declaracaoComErro ? true : undefined}
            onChange={(e) => atualizar({ declaracao: e.target.value as Declaracao })}
          >
            {Object.entries(DECLARACOES).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
      </div>

      {comFoto && <FotoSocio posicao={posicao} propria={responsavel} linha={linha} token={token} empresaId={empresaId} erroAutorizacao={erroAutorizacao} atualizar={atualizar} />}
    </div>
  );
}

function FotoSocio({
  posicao,
  propria,
  linha,
  token,
  empresaId,
  erroAutorizacao,
  atualizar,
}: {
  posicao: number;
  /** true no responsável: a foto é dele mesmo. Nos demais, é de outra pessoa. */
  propria: boolean;
  linha: Linha;
  token?: string;
  empresaId?: string;
  erroAutorizacao?: string;
  atualizar: (patch: Partial<Linha>) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);

  // Se o bloco sair da tela no meio do preparo, o resultado atrasado é ignorado.
  useEffect(
    () => () => {
      pedido.current++;
    },
    [],
  );

  function remover() {
    pedido.current++;
    if (entrada.current) entrada.current.value = "";
    atualizar(semFoto);
  }

  async function selecionar(arquivo?: File) {
    const atual = ++pedido.current;
    atualizar({ ...semFoto, preparando: !!arquivo });
    if (!arquivo) return;
    try {
      const preparada = await prepararFotoRosto(arquivo);
      if (atual === pedido.current) atualizar({ foto: preparada, preparando: false });
    } catch (e) {
      if (atual === pedido.current) {
        atualizar({ preparando: false, erroFoto: e instanceof Error ? e.message : "Não foi possível preparar esta foto." });
      }
    }
  }

  // Edição: o sócio já tem uma foto salva (mostrada por um link temporário do servidor).
  const temAtual = !!linha.fotoAtualId && linha.indiceOriginal !== undefined && !!token && !!empresaId;
  const mostraAtual = temAtual && !linha.fotoRemovida && !linha.foto && !linha.preparando && !linha.erroFoto;

  return (
    <div className="grid gap-3 border-t border-[#e6dfec] pt-4">
      <p className="m-0 font-bold">Foto do rosto (opcional)</p>
      {mostraAtual && (
        <div className="flex flex-wrap items-center gap-3">
          <FotoDoSocio token={token!} empresaId={empresaId!} indice={linha.indiceOriginal!} nome={linha.nome || "sócio"} temFoto />
          <div className="grid gap-1.5">
            <p className="m-0 font-semibold">Foto atual</p>
            <div>
              <button type="button" className={mm.botaoSecundario} onClick={() => atualizar({ fotoRemovida: true })}>Remover foto atual</button>
            </div>
          </div>
        </div>
      )}
      {temAtual && linha.fotoRemovida && !linha.foto && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="m-0">A foto atual será removida ao salvar.</p>
          <button type="button" className={mm.botaoSecundario} onClick={() => atualizar({ fotoRemovida: false })}>Desfazer</button>
        </div>
      )}
      <p className={mm.dica}>
        {propria
          ? "Envie sua própria foto apenas se desejar disponibilizá-la à organização para análise manual da autodeclaração, quando necessário."
          : "Envie a foto deste sócio ou titular apenas se desejar disponibilizá-la à organização para análise manual da autodeclaração, quando necessário."}{" "}
        A imagem fica restrita à administração da premiação.
      </p>
      <label className={mm.rotulo}>
        <span>
          {mostraAtual ? "Trocar a foto (JPEG ou PNG)" : "Selecionar foto JPEG ou PNG"}<span className="sr-only"> do {posicao}º sócio</span>
        </span>
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png"
          className={mm.campo}
          onChange={(e) => void selecionar(e.target.files?.[0])}
        />
      </label>
      <p className={mm.dica}>Fotos maiores que 12 MB são reduzidas no navegador antes do envio.</p>
      {linha.preparando && <p role="status" className="m-0">Preparando a foto…</p>}
      {linha.foto && <p role="status" className="m-0">Foto pronta para enviar.</p>}
      {(linha.foto || linha.erroFoto || linha.preparando) && (
        <div>
          <button type="button" className={mm.botaoSecundario} onClick={remover}>Remover foto</button>
        </div>
      )}
      {linha.erroFoto && <p className={mm.falha} role="alert">{linha.erroFoto}</p>}
      {linha.foto && (
        <div className="grid gap-1.5">
          <label className={mm.marcar}>
            <input
              type="checkbox"
              checked={linha.autorizada}
              onChange={(e) => atualizar({ autorizada: e.target.checked })}
              className={`${mm.checkbox} ${erroAutorizacao ? mm.checkboxErro : ""}`}
              {...ariaCampo(`autorizacao-${linha.id}`, erroAutorizacao, true)}
            />
            <span>
              {propria
                ? "Confirmo que esta foto é minha e autorizo seu uso pela organização para a análise da minha autodeclaração na premiação."
                : "Confirmo que esta pessoa autorizou o envio desta foto e o seu uso pela organização para a análise da autodeclaração na premiação."}
              <Obrigatorio />
            </span>
          </label>
          <MensagemErro id={`autorizacao-${linha.id}`} erro={erroAutorizacao} />
        </div>
      )}
    </div>
  );
}
