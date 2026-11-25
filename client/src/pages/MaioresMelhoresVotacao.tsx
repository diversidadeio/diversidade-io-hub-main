import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MolduraMm } from "@/components/maiores-melhores/Moldura";
import VotacaoPublica from "@/components/maiores-melhores/VotacaoPublica";
import { mm } from "@/components/maiores-melhores/estilo";
import { mmApi } from "@/lib/maioresMelhoresApi";

export default function MaioresMelhoresVotacao() {
  const [eventoId, setEventoId] = useState<string | null>();
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    document.title = "Votação popular | Maiores & Melhores";
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
  }, []);

  return (
    <MolduraMm>
      <div className="py-6">
        <Link className={mm.botaoSecundario + " mb-5"} href="/maiores-e-melhores">Voltar à página da premiação</Link>
        {eventoId ? <VotacaoPublica evento={eventoId} /> : (
          <section className={mm.painel} aria-labelledby="votacao-titulo">
            <h2 id="votacao-titulo" className={mm.titulo}>Votação popular</h2>
            {falha ? <p role="alert">Não foi possível carregar a premiação. Atualize a página para tentar novamente.</p>
              : <p role="status">{eventoId === undefined ? "Carregando a premiação…" : "Nenhuma edição da premiação está ativa."}</p>}
          </section>
        )}
      </div>
    </MolduraMm>
  );
}
