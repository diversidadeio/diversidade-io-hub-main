/**
 * Classes Tailwind do módulo Maiores & Melhores.
 * Paleta e proporções seguem a referência visual do pacote v13 (layout/index.html).
 */
export const mm = {
  pagina: "min-h-screen bg-[#f7f4fa] text-[#271939]",
  container: "mx-auto w-full max-w-[1260px] px-4 sm:px-8 lg:px-[3.25rem]",
  painel: "bg-white border border-[#e6dfec] rounded-2xl p-4 sm:p-8 min-w-0",
  titulo: "text-[clamp(1.5rem,3vw,2.1rem)] leading-[1.16] tracking-[-0.04em] font-bold mb-5",
  rotulo: "grid gap-1.5 content-start min-w-0 text-[0.92rem] font-semibold",
  campo:
    "w-full min-w-0 rounded-lg border border-[#cec3d6] bg-white px-3 py-2.5 min-h-[45px] text-[#271939] text-base font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-[#9066bf]/60 disabled:opacity-60",
  /** Mesmo campo, com borda vermelha: usado quando a validação encontra um problema. */
  campoErro:
    "w-full min-w-0 rounded-lg border border-[#d92d20] bg-[#fffbfa] px-3 py-2.5 min-h-[45px] text-[#271939] text-base font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-[#d92d20]/40 disabled:opacity-60",
  campoLeitura: "bg-[#f5f0f8]",
  /** Mensagem vermelha sob o campo. */
  erro: "m-0 text-[0.85rem] font-semibold text-[#b42318]",
  /** Faixa de resumo ao lado do botão de enviar. */
  resumoErro: "m-0 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-4 py-3 font-semibold text-[#b42318]",
  checkboxErro: "outline outline-2 outline-offset-1 outline-[#d92d20]",
  conjuntoErro: "border border-[#d92d20] rounded-xl p-4 m-0 min-w-0",
  botao:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[#5c2686] bg-[#5c2686] px-3.5 py-2.5 min-h-[42px] text-[0.92rem] font-bold text-white hover:bg-[#48196d] disabled:opacity-55 disabled:cursor-default cursor-pointer no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-[#9066bf]/60",
  botaoSecundario:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[#d9c9e3] bg-white px-3.5 py-2.5 min-h-[42px] text-[0.92rem] font-bold text-[#5c2686] hover:bg-[#f3ebf8] disabled:opacity-55 disabled:cursor-default cursor-pointer no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-[#9066bf]/60",
  grade: "grid grid-cols-1 sm:grid-cols-2 gap-4",
  pilha: "grid gap-5",
  dica: "text-[#62566f] text-sm m-0",
  conjunto: "border border-[#e6dfec] rounded-xl p-4 m-0 min-w-0",
  legenda: "font-bold px-2",
  cartao: "bg-white border border-[#e6dfec] rounded-xl p-4 min-w-0 break-words",
  vazio: "p-5 bg-[#f7f4fa] rounded-lg text-[#62566f]",
  marcar: "flex items-start gap-2.5 font-medium text-sm",
  checkbox: "mt-0.5 w-[18px] h-[18px] flex-none accent-[#5c2686]",
  sucesso: "px-4 py-3 rounded-lg mb-4 bg-[#e3f3e8] text-[#205c39]",
  falha: "px-4 py-3 rounded-lg bg-[#fbe8ee] text-[#84243f]",
  acoes: "flex gap-2 flex-wrap mt-3",
  sobrancelha: "uppercase tracking-[0.14em] text-[0.82rem] font-extrabold mb-3",
} as const;

export const corStatus = {
  pendente: "bg-[#faecd8] text-[#754314]",
  validado: "bg-[#e3f3e8] text-[#205c39]",
  indeferido: "bg-[#fbe8ee] text-[#84243f]",
} as const;
