import { ordenarRanking, urlPublica, type RankingVoto } from "@/lib/maioresMelhoresVotacao";
import { mm } from "./estilo";

const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

export function RankingVotacao({ linhas, aoVotar, selecionado }: {
  linhas: RankingVoto[];
  aoVotar?: (linha: RankingVoto) => void;
  selecionado?: string;
}) {
  if (!linhas.length) return <p className={mm.dica}>Nenhum concorrente publicado nesta categoria.</p>;
  return (
    <ul className="grid gap-3">
      {ordenarRanking(linhas).map((linha) => {
        const imagem = urlPublica(linha.logo) || urlPublica(linha.foto);
        const site = urlPublica(linha.site);
        const instagram = urlPublica(linha.instagram);
        const local = [linha.cidade, linha.uf].filter(Boolean).join(" / ");
        return (
          <li key={linha.id} className={mm.cartao}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="font-bold text-[#5c2686]">{linha.posicao}º</span>
              {imagem && <img src={imagem} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-12 rounded-lg object-contain" />}
              <div className="flex-1 min-w-40">
                <p className="font-bold">{linha.nome}</p>
                {linha.razao_social && linha.razao_social !== linha.nome && <p className={mm.dica}>{linha.razao_social}</p>}
                {local && <p className={mm.dica}>{local}</p>}
                {linha.descricao && <p className="mt-1 text-sm">{linha.descricao}</p>}
                {(site || instagram) && <div className="flex gap-3 text-sm mt-1">
                  {site && <a href={site} target="_blank" rel="noreferrer" className="underline">Site</a>}
                  {instagram && <a href={instagram} target="_blank" rel="noreferrer" className="underline">Instagram</a>}
                </div>}
              </div>
              <div className="text-sm">
                <div>{linha.votos.toLocaleString("pt-BR")} {linha.votos === 1 ? "voto" : "votos"}</div>
                <div>{percentual.format(linha.percentual / 100)} dos votos recebidos</div>
              </div>
              {aoVotar && <button type="button" className={mm.botaoSecundario}
                aria-label={"Votar em " + linha.nome} aria-pressed={linha.id === selecionado}
                onClick={() => aoVotar(linha)}>{linha.id === selecionado ? "Selecionada" : "Votar"}</button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
