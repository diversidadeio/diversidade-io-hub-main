import * as React from "react";
import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/* ─────────────────────────────────────────────────────────────
   Dados estáticos
   ───────────────────────────────────────────────────────────── */
const MESES = [
  "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
  "jul.", "ago.", "set.", "out.", "nov.", "dez.",
];

const ITEM_HEIGHT = 44;
const VISIBLE = 5;
const EXTRA = Math.floor(VISIBLE / 2);

/* ─────────────────────────────────────────────────────────────
   Rolo genérico
   ───────────────────────────────────────────────────────────── */
interface DrumColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

function DrumColumn({ items, selectedIndex, onChange }: DrumColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => { scrollToIndex(selectedIndex, false); }, []);
  useEffect(() => { scrollToIndex(selectedIndex, true); }, [selectedIndex]);

  const handleScrollEnd = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const snapped = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(snapped, items.length - 1));
    if (clamped !== selectedIndex) onChange(clamped);
    else scrollToIndex(clamped, true);
  }, [items.length, onChange, selectedIndex, scrollToIndex]);

  const handleScroll = () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(handleScrollEnd, 120);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startScrollTop.current = containerRef.current?.scrollTop ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dy = startY.current - e.clientY;
    if (containerRef.current) containerRef.current.scrollTop = startScrollTop.current + dy;
  };
  const onPointerUp = () => {
    isDragging.current = false;
    handleScrollEnd();
  };

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={{ height: ITEM_HEIGHT * VISIBLE }}
    >
      {/* Gradientes de fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-white to-transparent" />

      {/* Linha de seleção */}
      <div
        className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-b-2 border-[#7030A0]/40"
        style={{ top: ITEM_HEIGHT * EXTRA, height: ITEM_HEIGHT }}
      />

      {/* Lista rolável */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll select-none"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div style={{ height: ITEM_HEIGHT * EXTRA }} />
        {items.map((label, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center text-base font-medium transition-all duration-150 cursor-pointer",
              i === selectedIndex
                ? "text-[#7030A0] text-lg font-semibold"
                : "text-gray-400"
            )}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => onChange(i)}
          >
            {label}
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT * EXTRA }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente principal
   ───────────────────────────────────────────────────────────── */
interface DrumDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

function diasNoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

export function DrumDatePicker({ value, onChange, label = "Data de Nascimento" }: DrumDatePickerProps) {
  const [open, setOpen] = useState(false);

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();

  const parseValue = () => {
    if (value && value.length === 10) {
      const [d, m, a] = value.split("/").map(Number);
      if (d && m && a) return { dia: d, mes: m, ano: a };
    }
    return { dia: diaAtual, mes: mesAtual, ano: anoAtual };
  };

  const initial = parseValue();
  const ANOS = Array.from({ length: 120 }, (_, i) => String(anoAtual - i));

  const [diaIdx, setDiaIdx] = useState(initial.dia - 1);
  const [mesIdx, setMesIdx] = useState(initial.mes - 1);
  const [anoIdx, setAnoIdx] = useState(
    Math.max(0, ANOS.indexOf(String(initial.ano)))
  );

  const totalDias = diasNoMes(mesIdx + 1, parseInt(ANOS[anoIdx]));
  const dias = Array.from({ length: totalDias }, (_, i) => String(i + 1));
  const diaIdxClamped = Math.min(diaIdx, totalDias - 1);

  const confirmar = () => {
    const d = String(diaIdxClamped + 1).padStart(2, "0");
    const m = String(mesIdx + 1).padStart(2, "0");
    const a = ANOS[anoIdx];
    onChange(`${d}/${m}/${a}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-left shadow-sm hover:border-[#7030A0] transition-colors"
        >
          <CalendarDays className="w-4 h-4 text-[#7030A0]" />
          <span className={value ? "text-gray-800" : "text-gray-400"}>
            {value || "Selecione a data"}
          </span>
        </button>
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="sm:max-w-[340px] max-w-[92vw] p-0 rounded-[1.25rem] overflow-hidden gap-0 border-0 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10 relative">
          <button
            type="button"
            className="text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
          <span className="font-semibold text-gray-800 text-[15px]">{label}</span>
          <button
            type="button"
            className="text-[#7030A0] font-bold text-sm hover:opacity-80 transition-opacity"
            onClick={confirmar}
          >
            Pronto
          </button>
        </div>

        {/* Rolos */}
        <div className="flex gap-1 px-4 py-4 overflow-hidden bg-white relative z-0">
          <DrumColumn items={dias}  selectedIndex={diaIdxClamped} onChange={setDiaIdx} />
          <DrumColumn items={MESES} selectedIndex={mesIdx}        onChange={setMesIdx} />
          <DrumColumn items={ANOS}  selectedIndex={anoIdx}        onChange={setAnoIdx} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
