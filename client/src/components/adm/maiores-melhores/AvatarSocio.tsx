import { useEffect, useState } from "react";
import type { MmSocio } from "@/lib/maioresMelhores";
import { assinarFotos } from "@/lib/maioresMelhoresApi";

/**
 * Links temporários (3 h) das fotos dos sócios. As fotos ficam num bucket privado: assina só os
 * caminhos que ainda não têm link, conforme a lista mostrada muda.
 */
export function useFotosAssinadas(caminhos: string[]) {
  const [fotos, setFotos] = useState<Map<string, string>>(new Map());
  const chave = caminhos.join("|");
  useEffect(() => {
    const faltantes = chave ? chave.split("|").filter((c) => !fotos.has(c)) : [];
    if (!faltantes.length) return;
    let ativo = true;
    assinarFotos(faltantes, 3 * 60 * 60)
      .then((novos) => {
        if (ativo && novos.size) setFotos((atual) => new Map([...atual, ...novos]));
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [chave, fotos]);
  return fotos;
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toLocaleUpperCase("pt-BR");

/** Foto do sócio (clique abre em tamanho original) ou, sem foto, as iniciais do nome. */
export function Avatar({ nome, url, tamanho, temFoto }: { nome: string; url?: string; tamanho: "sm" | "lg"; temFoto: boolean }) {
  const dimensao = tamanho === "lg" ? "h-16 w-16 text-lg" : "h-10 w-10 text-sm";
  const base = `${dimensao} shrink-0 rounded-full object-cover ring-2 ring-white`;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" title={`Abrir foto de ${nome}`} onClick={(ev) => ev.stopPropagation()}>
        <img src={url} alt={`Foto de ${nome}`} loading="lazy" className={base} />
      </a>
    );
  }
  return (
    <span
      className={`${dimensao} shrink-0 inline-flex items-center justify-center rounded-full bg-purple-100 font-semibold text-[#7030A0] ring-2 ring-white ${temFoto ? "animate-pulse" : ""}`}
      title={temFoto ? "Carregando foto..." : `${nome} (sem foto)`}
      aria-label={nome}
    >
      {iniciais(nome) || "?"}
    </span>
  );
}

/** Até 3 sócios sobrepostos no cabeçalho da empresa; o excedente vira "+N". */
export function PilhaAvatares({ socios, fotos }: { socios: MmSocio[]; fotos: Map<string, string> }) {
  if (!socios.length) return null;
  const visiveis = socios.slice(0, 3);
  return (
    <div className="flex shrink-0 items-center -space-x-3">
      {visiveis.map((s, i) => (
        <Avatar key={i} nome={s.nome} url={s.foto_path ? fotos.get(s.foto_path) : undefined} tamanho="sm" temFoto={!!s.foto_path} />
      ))}
      {socios.length > visiveis.length && (
        <span className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 ring-2 ring-white">
          +{socios.length - visiveis.length}
        </span>
      )}
    </div>
  );
}
