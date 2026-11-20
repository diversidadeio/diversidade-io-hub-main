import type { ReactNode } from "react";
import { Link } from "wouter";
import { Award, LockKeyhole } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { mm } from "./estilo";

/** Cabeçalho, conteúdo e rodapé da área pública do Maiores & Melhores. */
export function MolduraMm({ children, direita }: { children: ReactNode; direita?: ReactNode }) {
  return (
    <div className={mm.pagina}>
      <header className="bg-white border-b border-[#e6dfec]">
        <div className={`${mm.container} min-h-[68px] flex items-center justify-between gap-4 flex-wrap py-2`}>
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center" aria-label="Voltar para a Diversidade.io">
              <img src={logoImage} alt="Diversidade.io" className="h-8 w-auto" />
            </Link>
            <span className="h-6 w-px bg-[#e6dfec]" aria-hidden="true" />
            <span className="flex items-center gap-2 font-extrabold tracking-[-0.04em] text-[1.16rem]">
              <Award size={24} className="text-[#5c2686]" />
              <span>Maiores <i className="text-[#5c2686]">&amp;</i> Melhores</span>
            </span>
          </div>
          {direita}
        </div>
      </header>
      <main className={mm.container}>{children}</main>
      <footer className={`${mm.container} flex flex-wrap items-center gap-2 py-6 text-[#62566f] text-[0.89rem]`}>
        <LockKeyhole size={16} /> Dados de inscrição e negócios com acesso restrito.
        <a href="/politica-de-privacidade" className="underline underline-offset-2 hover:text-[#5c2686]">Política de privacidade</a>
      </footer>
    </div>
  );
}

export function HeroMm({ sobrancelha, texto, detalhe }: { sobrancelha: string; texto: string; detalhe?: ReactNode }) {
  return (
    <section
      className="relative isolate overflow-hidden my-6 min-h-[235px] sm:min-h-[280px] flex items-center rounded-[20px] text-white p-6 sm:p-10 lg:p-14"
      style={{ background: "radial-gradient(ellipse at right, #643489 0%, #351652 58%, #28123e 100%)" }}
    >
      <div className="relative z-10">
        <p className={`${mm.sobrancelha} text-[#f5bf64]`}>{sobrancelha}</p>
        <h1 className="text-white text-[clamp(2.35rem,6.6vw,5rem)] leading-[1.02] tracking-[-0.04em] font-extrabold mb-4">
          Maiores <em className="not-italic text-[#f5bf64]">&amp;</em> Melhores
          <span className="block text-[0.51em] leading-[1.17] tracking-[-0.02em] mt-[0.3em]">no Empreendedorismo Negro</span>
        </h1>
        <p className="max-w-[38rem] text-[#f0e8f5] m-0">{texto}</p>
        {detalhe && <div className="mt-4">{detalhe}</div>}
      </div>
      <div
        aria-hidden="true"
        className="absolute right-[4%] top-1/2 -translate-y-1/2 w-[clamp(7rem,24vw,18rem)] aspect-square rounded-full grid place-items-center text-[#f5bf64] border border-[#e7b46866] outline outline-1 outline-offset-[12px] outline-[#e7b46842] bg-[#28123e28] opacity-35 md:opacity-100"
      >
        <Award className="w-[47%] h-[47%]" strokeWidth={1.05} />
      </div>
    </section>
  );
}
