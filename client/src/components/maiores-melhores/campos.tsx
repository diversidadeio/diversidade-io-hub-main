import { useCallback, useState } from "react";
import type { Erros } from "@/lib/validacao";
import { mm } from "./estilo";

export type { Erros };

/** Erros por campo, com atalho para limpar o erro de um campo quando a pessoa volta a editá-lo. */
export function useErros() {
  const [erros, definir] = useState<Erros>({});
  const limpar = useCallback(
    (...campos: string[]) =>
      definir((atual) => {
        if (!campos.some((campo) => atual[campo])) return atual;
        const proximo = { ...atual };
        for (const campo of campos) delete proximo[campo];
        return proximo;
      }),
    [],
  );
  return { erros, definir, limpar };
}

/** Classe do campo: borda vermelha quando há erro. */
export const classeCampo = (erro?: string) => (erro ? mm.campoErro : mm.campo);

/** Atributos de acessibilidade do campo: avisa o leitor de tela do erro e se o campo é obrigatório. */
export const ariaCampo = (id: string, erro?: string, obrigatorio = false) => ({
  "aria-invalid": erro ? (true as const) : undefined,
  "aria-describedby": erro ? `erro-${id}` : undefined,
  "aria-required": obrigatorio ? (true as const) : undefined,
});

/** Mensagem vermelha sob o campo. */
export function MensagemErro({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <p id={`erro-${id}`} role="alert" className={mm.erro}>
      {erro}
    </p>
  );
}

/** Asterisco dos campos obrigatórios (leitores de tela falam "obrigatório"). */
export function Obrigatorio() {
  return (
    <>
      <span aria-hidden="true" className="text-[#b42318]"> *</span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  );
}

export function Opcional() {
  return <span className="font-normal text-[#62566f]"> (opcional)</span>;
}

/** Aviso no topo dos formulários. */
export function LegendaObrigatorios() {
  return (
    <p className={mm.dica}>
      Os campos com <span aria-hidden="true" className="font-bold text-[#b42318]">*</span>
      <span className="sr-only">asterisco</span> são obrigatórios.
    </p>
  );
}

/** Faixa ao lado do botão de enviar, dizendo quantas informações faltam. */
export function ResumoErros({ erros }: { erros: Erros }) {
  const total = Object.keys(erros).length;
  if (!total) return null;
  return (
    <p role="alert" className={mm.resumoErro}>
      {total === 1 ? "Falta 1 informação. Ela está marcada em vermelho." : `Faltam ${total} informações. Elas estão marcadas em vermelho.`}
    </p>
  );
}

/** Leva a tela e o foco ao primeiro campo com problema (o primeiro na ordem da página). */
export function irParaPrimeiroErro(raiz: ParentNode) {
  setTimeout(() => {
    const campo = raiz.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!campo) return;
    campo.scrollIntoView({ block: "center", behavior: "smooth" });
    campo.focus({ preventScroll: true });
  }, 0);
}
