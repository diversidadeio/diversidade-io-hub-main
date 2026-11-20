import { useEffect, useState } from "react";
import { ImageOff, Pencil, Plus, UserRound } from "lucide-react";
import { CATEGORIAS, DECLARACOES, type MmEmpresa, formatarCnpj, formatarData } from "@/lib/maioresMelhores";
import { mmApi } from "@/lib/maioresMelhoresApi";
import { mm } from "./estilo";

interface Props {
  empresa: MmEmpresa;
  token: string;
  totalNegocios: number;
  /** Período de inscrições aberto: só então dá para registrar novos negócios. */
  aberto: boolean;
  aoRegistrarNegocio: () => void;
  aoVerNegocios: () => void;
  /** Só dentro do período de inscrições. */
  aoEditar: () => void;
}

/** Dados da inscrição já feita, com a foto de cada sócio. */
export function MinhaInscricao({ empresa, token, totalNegocios, aberto, aoRegistrarNegocio, aoVerNegocios, aoEditar }: Props) {
  const afro = empresa.categoria === "afro";
  return (
    <article className={`${mm.cartao} grid gap-5`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-xl font-bold leading-tight text-[#271939] break-words">{empresa.razao_social}</h3>
          <p className="m-0 text-[#62566f]">
            {formatarCnpj(empresa.cnpj)} · {empresa.municipio}/{empresa.uf}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#f2e8f8] px-2.5 py-1 text-xs font-bold text-[#5c2686]">{CATEGORIAS[empresa.categoria]}</span>
          <span className="rounded-full bg-[#f7f4fa] px-2.5 py-1 text-xs font-bold text-[#62566f]">{empresa.porte}</span>
        </div>
      </header>

      <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Dado rotulo="Responsável pela inscrição" valor={empresa.responsavel} />
        <Dado rotulo="E-mail de contato" valor={empresa.email} />
        <Dado rotulo="Inscrita em" valor={formatarData(empresa.criado_em)} />
        <Dado rotulo="Negócios registrados" valor={String(totalNegocios)} />
      </dl>

      <div>
        <h4 className="m-0 mb-3 font-bold text-[#271939]">Sócios e titulares</h4>
        {empresa.socios.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {empresa.socios.map((socio, i) => (
              <li key={i} className="flex items-center gap-3">
                {afro && (
                  <FotoDoSocio token={token} empresaId={empresa.id} indice={i} nome={socio.nome} temFoto={!!socio.tem_foto} />
                )}
                <div className="min-w-0">
                  <p className="m-0 font-semibold break-words">{socio.nome}</p>
                  <p className="m-0 text-sm text-[#62566f]">
                    {afro && i === 0 && "Responsável pela inscrição · "}
                    {DECLARACOES[socio.declaracao]}
                    {afro && !socio.tem_foto && " · Sem foto"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={mm.dica}>Nenhum sócio informado.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {aberto && (
          <button type="button" className={mm.botao} onClick={aoRegistrarNegocio}>
            <Plus size={17} /> Registrar negócio
          </button>
        )}
        <button type="button" className={mm.botaoSecundario} onClick={aoVerNegocios}>
          Ver meus negócios ({totalNegocios})
        </button>
        {aberto && (
          <button type="button" className={mm.botaoSecundario} onClick={aoEditar}>
            <Pencil size={16} /> Editar inscrição
          </button>
        )}
      </div>
    </article>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.85rem] text-[#62566f]">{rotulo}</dt>
      <dd className="m-0 font-semibold break-words">{valor}</dd>
    </div>
  );
}

type EstadoFoto = { tipo: "carregando" } | { tipo: "ok"; url: string } | { tipo: "erro" } | { tipo: "sem" };

/** A foto vem de um link temporário gerado pelo servidor; buscamos ao mostrar o cartão. */
export function FotoDoSocio({ token, empresaId, indice, nome, temFoto }: { token: string; empresaId: string; indice: number; nome: string; temFoto: boolean }) {
  const [estado, setEstado] = useState<EstadoFoto>(temFoto ? { tipo: "carregando" } : { tipo: "sem" });

  useEffect(() => {
    if (!temFoto) {
      setEstado({ tipo: "sem" });
      return;
    }
    let ativo = true;
    setEstado({ tipo: "carregando" });
    mmApi
      .urlFotoSocio(token, empresaId, indice)
      .then((url) => ativo && setEstado({ tipo: "ok", url }))
      .catch(() => ativo && setEstado({ tipo: "erro" }));
    return () => {
      ativo = false;
    };
  }, [token, empresaId, indice, temFoto]);

  const caixa = "grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full border border-[#e6dfec] bg-[#f7f4fa] text-[#9a8aa8]";
  if (estado.tipo === "ok") {
    return <img src={estado.url} alt={`Foto de ${nome}`} className={`${caixa} object-cover`} onError={() => setEstado({ tipo: "erro" })} />;
  }
  if (estado.tipo === "carregando") return <div role="img" aria-label="Carregando foto" className={`${caixa} animate-pulse`} />;
  if (estado.tipo === "erro") {
    return (
      <div role="img" aria-label="Foto enviada, mas não foi possível carregá-la agora" title="Foto enviada, mas não foi possível carregá-la agora" className={caixa}>
        <ImageOff size={22} />
      </div>
    );
  }
  return (
    <div role="img" aria-label="Sem foto" className={caixa}>
      <UserRound size={26} />
    </div>
  );
}
