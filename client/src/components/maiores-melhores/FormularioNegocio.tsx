import { type FormEvent, useState } from "react";
import {
  PERFIS_PARCEIRO,
  type MmEmpresa,
  type PerfilParceiro,
  converterValorEmCentavos,
  formatarCnpj,
  hojeSaoPaulo,
  normalizarCnpj,
  papelDaInscrita,
  perfisPermitidos,
} from "@/lib/maioresMelhores";
import { mascarar, mascaraCnpj, mascaraDigitos, mascaraMoeda, mascaraSerieNota, mascaraTelefone } from "@/lib/mascaras";
import { validarNegocio } from "@/lib/validacao";
import {
  LegendaObrigatorios,
  MensagemErro,
  Obrigatorio,
  Opcional,
  ResumoErros,
  ariaCampo,
  classeCampo,
  irParaPrimeiroErro,
  useErros,
} from "./campos";
import { mm } from "./estilo";

interface Props {
  /** A empresa inscrita do participante (cada participante tem uma só). */
  empresa: MmEmpresa;
  aoSalvar: (dados: Record<string, unknown>, emailComprador: string) => Promise<boolean>;
}

export function FormularioNegocio({ empresa, aoSalvar }: Props) {
  return (
    <div className={mm.pilha}>
      <div className={mm.cartao}>
        <strong>{empresa.razao_social}</strong>
        <p className="m-0 text-[#62566f]">{formatarCnpj(empresa.cnpj)}</p>
      </div>
      <DetalhesNegocio key={empresa.id} empresa={empresa} aoSalvar={aoSalvar} />
    </div>
  );
}

function DetalhesNegocio({ empresa, aoSalvar }: { empresa: MmEmpresa; aoSalvar: Props["aoSalvar"] }) {
  const [perfil, setPerfil] = useState<PerfilParceiro>("afro");
  const [papelEscolhido, setPapelEscolhido] = useState<"comprador" | "vendedor">("vendedor");
  const [chave, setChave] = useState(0);
  const { erros, definir, limpar } = useErros();
  const papel = papelDaInscrita(empresa.categoria, perfil, papelEscolhido);
  const cnpjProprio = formatarCnpj(empresa.cnpj);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const campos = Object.fromEntries(new FormData(form)) as Record<string, string>;
    // Mostra de uma vez tudo o que falta: cada campo fica vermelho, com a mensagem embaixo.
    const problemas = validarNegocio({
      cnpj_comprador: campos.cnpj_comprador ?? "",
      cnpj_vendedor: campos.cnpj_vendedor ?? "",
      razao_social_parceiro: campos.razao_social_parceiro ?? "",
      data_emissao: campos.data_emissao ?? "",
      valor: campos.valor ?? "",
      numero_nota: campos.numero_nota ?? "",
      serie_nota: campos.serie_nota ?? "",
      email_comprador: campos.email_comprador ?? "",
      whatsapp_comprador: campos.whatsapp_comprador ?? "",
      papelDaInscrita: papel,
    });
    definir(problemas);
    if (Object.keys(problemas).length) {
      irParaPrimeiroErro(form);
      return;
    }

    const ok = await aoSalvar(
      {
        empresa_id: empresa.id,
        perfil_parceiro: perfil,
        cnpj_comprador: normalizarCnpj(campos.cnpj_comprador),
        cnpj_vendedor: normalizarCnpj(campos.cnpj_vendedor),
        razao_social_parceiro: campos.razao_social_parceiro,
        data_emissao: campos.data_emissao,
        valor_centavos: String(converterValorEmCentavos(campos.valor)),
        numero_nota: campos.numero_nota,
        serie_nota: campos.serie_nota ?? "",
        email_comprador: campos.email_comprador,
        whatsapp_comprador: campos.whatsapp_comprador ?? "",
      },
      campos.email_comprador,
    );
    if (ok) {
      definir({});
      setChave((n) => n + 1);
    }
  }

  const campoCnpj = (nome: "cnpj_comprador" | "cnpj_vendedor", rotulo: string, proprio: boolean) => (
    <label className={mm.rotulo}>
      <span>{rotulo}<Obrigatorio /></span>
      <input
        key={`${nome}-${proprio}`}
        name={nome}
        defaultValue={proprio ? cnpjProprio : undefined}
        readOnly={proprio}
        maxLength={18}
        placeholder="00.000.000/0000-00"
        autoCapitalize="characters"
        className={`${classeCampo(erros[nome])} ${proprio ? mm.campoLeitura : ""}`}
        onChange={(e) => {
          mascarar(e, mascaraCnpj);
          limpar(nome);
        }}
        {...ariaCampo(nome, erros[nome], true)}
      />
      {proprio && <small className="font-normal text-[#62566f]">É o CNPJ da sua empresa, já preenchido.</small>}
      <MensagemErro id={nome} erro={erros[nome]} />
    </label>
  );

  return (
    <form onSubmit={enviar} className={mm.pilha} noValidate>
      <LegendaObrigatorios />
      <div className={mm.grade}>
        <label className={mm.rotulo}>
          Perfil da parceira
          <select className={mm.campo} value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilParceiro)}>
            {perfisPermitidos(empresa.categoria).map((p) => <option key={p} value={p}>{PERFIS_PARCEIRO[p]}</option>)}
          </select>
        </label>
        {empresa.categoria === "afro" && perfil === "afro" && (
          <label className={mm.rotulo}>
            Papel da empresa inscrita
            <select className={mm.campo} value={papelEscolhido} onChange={(e) => setPapelEscolhido(e.target.value as "comprador" | "vendedor")}>
              <option value="vendedor">Vendedora</option>
              <option value="comprador">Compradora</option>
            </select>
          </label>
        )}
      </div>
      <div className={mm.grade} key={chave}>
        {campoCnpj("cnpj_comprador", "CNPJ da empresa compradora", papel === "comprador")}
        {campoCnpj("cnpj_vendedor", "CNPJ da empresa vendedora", papel === "vendedor")}
        <label className={mm.rotulo}>
          <span>Razão social da empresa parceira<Obrigatorio /></span>
          <input
            name="razao_social_parceiro"
            maxLength={180}
            className={classeCampo(erros.razao_social_parceiro)}
            onChange={() => limpar("razao_social_parceiro")}
            {...ariaCampo("razao_social_parceiro", erros.razao_social_parceiro, true)}
          />
          <MensagemErro id="razao_social_parceiro" erro={erros.razao_social_parceiro} />
        </label>
        <label className={mm.rotulo}>
          <span>Data de emissão da nota<Obrigatorio /></span>
          <input
            name="data_emissao"
            type="date"
            max={hojeSaoPaulo()}
            className={classeCampo(erros.data_emissao)}
            onChange={() => limpar("data_emissao")}
            {...ariaCampo("data_emissao", erros.data_emissao, true)}
          />
          <MensagemErro id="data_emissao" erro={erros.data_emissao} />
        </label>
        <label className={mm.rotulo}>
          <span>Valor total da nota (R$)<Obrigatorio /></span>
          <input
            name="valor"
            inputMode="numeric"
            placeholder="0,00"
            maxLength={21}
            className={classeCampo(erros.valor)}
            onChange={(e) => {
              mascarar(e, mascaraMoeda);
              limpar("valor");
            }}
            {...ariaCampo("valor", erros.valor, true)}
            aria-describedby={erros.valor ? "erro-valor dica-valor-nota" : "dica-valor-nota"}
          />
          <small id="dica-valor-nota" className="font-normal text-[#62566f]">Digite só os números: 150000 vira 1.500,00.</small>
          <MensagemErro id="valor" erro={erros.valor} />
        </label>
        <label className={mm.rotulo}>
          <span>Número da nota fiscal<Obrigatorio /></span>
          <input
            name="numero_nota"
            inputMode="numeric"
            maxLength={15}
            className={classeCampo(erros.numero_nota)}
            onChange={(e) => {
              mascarar(e, mascaraDigitos(15));
              limpar("numero_nota");
            }}
            {...ariaCampo("numero_nota", erros.numero_nota, true)}
            aria-describedby={erros.numero_nota ? "erro-numero_nota dica-numero-nota" : "dica-numero-nota"}
          />
          <small id="dica-numero-nota" className="font-normal text-[#62566f]">Digite apenas o número da nota, com até 15 algarismos.</small>
          <MensagemErro id="numero_nota" erro={erros.numero_nota} />
        </label>
        <label className={mm.rotulo}>
          <span>Série da nota (se houver)<Opcional /></span>
          <input
            name="serie_nota"
            maxLength={12}
            autoCapitalize="characters"
            className={classeCampo(erros.serie_nota)}
            onChange={(e) => {
              mascarar(e, mascaraSerieNota);
              limpar("serie_nota");
            }}
            {...ariaCampo("serie_nota", erros.serie_nota)}
          />
          <MensagemErro id="serie_nota" erro={erros.serie_nota} />
        </label>
        <label className={mm.rotulo}>
          <span>E-mail corporativo do comprador<Obrigatorio /></span>
          <input
            name="email_comprador"
            type="email"
            maxLength={180}
            className={classeCampo(erros.email_comprador)}
            onChange={() => limpar("email_comprador")}
            {...ariaCampo("email_comprador", erros.email_comprador, true)}
          />
          <MensagemErro id="email_comprador" erro={erros.email_comprador} />
        </label>
        <label className={mm.rotulo}>
          <span>WhatsApp do comprador<Opcional /></span>
          <input
            name="whatsapp_comprador"
            type="tel"
            inputMode="tel"
            maxLength={15}
            placeholder="(00) 00000-0000"
            className={classeCampo(erros.whatsapp_comprador)}
            onChange={(e) => {
              mascarar(e, mascaraTelefone);
              limpar("whatsapp_comprador");
            }}
            {...ariaCampo("whatsapp_comprador", erros.whatsapp_comprador)}
          />
          <MensagemErro id="whatsapp_comprador" erro={erros.whatsapp_comprador} />
        </label>
      </div>
      <p className={mm.dica}>
        Ao registrar, a plataforma envia um e-mail para o comprador com os dados da nota e um link para ele confirmar. Use o
        e-mail de outro representante da compradora, não o seu.
      </p>
      <ResumoErros erros={erros} />
      <div>
        <button className={mm.botao}>Registrar nota e enviar ao comprador</button>
      </div>
    </form>
  );
}
