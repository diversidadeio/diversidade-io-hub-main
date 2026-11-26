import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MolduraMm } from "@/components/maiores-melhores/Moldura";
import VotacaoPublica from "@/components/maiores-melhores/VotacaoPublica";
import AcompanharVotacao from "@/components/maiores-melhores/AcompanharVotacao";
import { mm } from "@/components/maiores-melhores/estilo";
import { mmApi } from "@/lib/maioresMelhoresApi";
import { ROTA_VOTACAO_MM, TITULO_VOTACAO_MM } from "@/lib/maioresMelhoresVotacao";

export function MaioresMelhoresAcompanhar() {
  return <PaginaVotacao acompanhar />;
}

export default function MaioresMelhoresVotacao() {
  return <PaginaVotacao />;
}

function PaginaVotacao({ acompanhar = false }: { acompanhar?: boolean }) {
  const [eventoId, setEventoId] = useState<string | null>();
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    document.title = (acompanhar ? "Acompanhar votação | " : "") + TITULO_VOTACAO_MM + " | Maiores & Melhores";
    let ativo = true;
    void mmApi.eventoAtual().then((evento) => {
      if (ativo) setEventoId(evento?.id ?? null);
    }).catch(() => {
      if (ativo) {
        setFalha(true);
        setEventoId(null);
      }
    });
    return () => { ativo = false; };
  }, [acompanhar]);

  return (
    <MolduraMm>
      <div className="py-6">
        <Link className={mm.botaoSecundario + " mb-5"} href={acompanhar ? ROTA_VOTACAO_MM : "/maiores-e-melhores"}>
          {acompanhar ? "Voltar à votação" : "Voltar à página da premiação"}
        </Link>
        {eventoId ? (
          acompanhar ? <AcompanharVotacao evento={eventoId} /> : <VotacaoPublica evento={eventoId} />
        ) : (
          <section className={mm.painel} aria-labelledby="votacao-titulo">
            <h2 id="votacao-titulo" className={mm.titulo}>{TITULO_VOTACAO_MM}</h2>
            {falha ? <p role="alert">Não foi possível carregar a premiação. Atualize a página para tentar novamente.</p>
              : <p role="status">{eventoId === undefined ? "Carregando a premiação…" : "Nenhuma edição da premiação está ativa."}</p>}
          </section>
        )}
      </div>
    </MolduraMm>
  );
}
