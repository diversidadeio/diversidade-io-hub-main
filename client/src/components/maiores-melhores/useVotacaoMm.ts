import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoriaVoto, ConfiguracaoVoto, RankingVoto } from "@/lib/maioresMelhoresVotacao";

export const API_VOTACAO_MM = "/api/maiores-melhores-votacao";
export const INTERVALO_VOTACAO_MS = 20000;

export interface Votacao extends ConfiguracaoVoto {
  aberta: boolean;
  categorias: Pick<CategoriaVoto, "id" | "nome">[];
  ranking: RankingVoto[];
}

export function useVotacaoMm(evento: string) {
  const [dados, setDados] = useState<Votacao | null>();
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date>();
  const requisicao = useRef<AbortController | undefined>(undefined);

  const atualizar = useCallback(async () => {
    requisicao.current?.abort();
    const controller = new AbortController();
    requisicao.current = controller;
    setCarregando(true);
    try {
      const resposta = await fetch(API_VOTACAO_MM + "?evento=" + encodeURIComponent(evento), { signal: controller.signal });
      if (!resposta.ok) throw new Error("Falha ao carregar a votação.");
      const atual = await resposta.json() as Votacao | null;
      if (!controller.signal.aborted) {
        setDados(atual);
        setFalhaLeitura(false);
        setAtualizadoEm(new Date());
      }
    } catch {
      if (!controller.signal.aborted) setFalhaLeitura(true);
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
    }
  }, [evento]);

  useEffect(() => {
    void atualizar();
    const timer = window.setInterval(atualizar, INTERVALO_VOTACAO_MS);
    return () => { window.clearInterval(timer); requisicao.current?.abort(); };
  }, [atualizar]);

  return { dados, falhaLeitura, carregando, atualizadoEm, atualizar };
}
