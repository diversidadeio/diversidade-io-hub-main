import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { TITULO_VOTACAO_MM, estadosVotacao } from "@/lib/maioresMelhoresVotacao";
import { RankingVotacao } from "./RankingVotacao";
import { INTERVALO_VOTACAO_MS, useVotacaoMm } from "./useVotacaoMm";
import { mm } from "./estilo";

const horaBrasilia = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

export default function AcompanharVotacao({ evento }: { evento: string }) {
  const { dados, falhaLeitura, carregando, atualizadoEm, atualizar } = useVotacaoMm(evento);
  const [categoriaId, setCategoriaId] = useState("");
  const categoria = dados?.categorias.find((item) => item.id === categoriaId) ?? dados?.categorias[0];
  const linhas = dados?.ranking.filter((linha) => linha.categoria_id === categoria?.id) ?? [];
  const votos = linhas.reduce((total, linha) => total + linha.votos, 0);

  return (
    <section aria-labelledby="acompanhar-titulo" className={mm.painel + " grid gap-5"}>
      <div>
        <h2 id="acompanhar-titulo" className={mm.titulo + " mb-2"}>Acompanhar {TITULO_VOTACAO_MM}</h2>
        {dados && <p className={mm.dica}>
          {dados.aberta ? "Votação aberta · apuração parcial" :
            dados.estado === "ativa" && Date.now() >= Date.parse(dados.fim)
              ? "Votação encerrada" : estadosVotacao[dados.estado]}
        </p>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {dados && categoria && <fieldset className="m-0 grid w-full min-w-0 gap-2 border-0 p-0 lg:w-auto lg:flex-1">
          <legend className="mb-2 text-sm font-semibold">Categoria</legend>
          <div className="grid gap-2 lg:grid-cols-3">
            {dados.categorias.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === categoria.id}
                className={item.id === categoria.id ? mm.botao : mm.botaoSecundario}
                onClick={() => setCategoriaId(item.id)}>
                {item.nome}
              </button>
            ))}
          </div>
        </fieldset>}
        <button type="button" className={mm.botaoSecundario} disabled={carregando} onClick={() => void atualizar()}>
          <RefreshCw aria-hidden="true" className={"size-4 " + (carregando ? "motion-safe:animate-spin" : "")} />
          {carregando ? "Atualizando…" : "Recarregar"}
        </button>
      </div>
      <p className={mm.dica}>
        Atualização automática a cada {INTERVALO_VOTACAO_MS / 1000} segundos.
        {atualizadoEm && " Última atualização às " + horaBrasilia.format(atualizadoEm) + " (horário de Brasília)."}
      </p>
      {falhaLeitura && <p role="status" className={mm.falha}>
        Não foi possível atualizar os votos. A próxima tentativa é automática.
      </p>}
      {categoria ? <>
        <h3 className="font-bold">{dados?.estado === "publicada" ? "Classificação definitiva" : "Ranking por categoria"}</h3>
        <p className={mm.dica}>{votos.toLocaleString("pt-BR")} {votos === 1 ? "voto" : "votos"} · {linhas.length} {linhas.length === 1 ? "empresa" : "empresas"}</p>
        <RankingVotacao linhas={linhas} />
      </> : !falhaLeitura && <p role="status" className={mm.dica}>
        {dados === undefined ? "Carregando votação…" : "Nenhuma categoria disponível."}
      </p>}
    </section>
  );
}
