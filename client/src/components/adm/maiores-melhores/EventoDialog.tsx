import { type FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MmEvento } from "@/lib/maioresMelhores";

export interface DadosEvento {
  ano: number;
  titulo: string;
  descricao: string | null;
  inicio_cadastro: string;
  fim_cadastro: string;
}

interface Props {
  aberto: boolean;
  evento?: MmEvento | null;
  aoFechar: () => void;
  aoSalvar: (dados: DadosEvento) => Promise<boolean>;
}

const campo = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";
const rotulo = "grid gap-1.5 text-sm font-medium text-gray-700";

export function EventoDialog({ aberto, evento, aoFechar, aoSalvar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const anoAtual = new Date().getFullYear();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.fim_cadastro < f.inicio_cadastro) {
      setErro("A data final deve ser igual ou posterior à data inicial.");
      return;
    }
    setErro("");
    setSalvando(true);
    const ok = await aoSalvar({
      ano: Number(f.ano),
      titulo: f.titulo.trim(),
      descricao: f.descricao.trim() || null,
      inicio_cadastro: f.inicio_cadastro,
      fim_cadastro: f.fim_cadastro,
    });
    setSalvando(false);
    if (ok) aoFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{evento ? `Editar edição ${evento.ano}` : "Nova edição"}</DialogTitle>
          <DialogDescription>
            O período de inscrição define quando o formulário fica aberto e quando o convite aparece na página inicial.
          </DialogDescription>
        </DialogHeader>
        <form key={evento?.id ?? "nova"} onSubmit={enviar} className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
            <label className={rotulo}>
              Ano
              <input name="ano" type="number" min={2020} max={2100} required defaultValue={evento?.ano ?? anoAtual} className={campo} />
            </label>
            <label className={rotulo}>
              Título
              <input
                name="titulo"
                required
                maxLength={180}
                defaultValue={evento?.titulo ?? "Maiores & Melhores no Empreendedorismo Negro"}
                className={campo}
              />
            </label>
          </div>
          <label className={rotulo}>
            Texto de apresentação (opcional)
            <textarea
              name="descricao"
              rows={3}
              maxLength={600}
              defaultValue={evento?.descricao ?? ""}
              placeholder="Inscreva sua empresa e registre os negócios que fortalecem o empreendedorismo negro."
              className={campo}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={rotulo}>
              Início das inscrições
              <input name="inicio_cadastro" type="date" required defaultValue={evento?.inicio_cadastro} className={campo} />
            </label>
            <label className={rotulo}>
              Fim das inscrições
              <input name="fim_cadastro" type="date" required defaultValue={evento?.fim_cadastro} className={campo} />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            As datas consideram o horário de Brasília. O último dia fica aberto até 23h59. Para publicar, salve e use o botão
            “Ativar edição”.
          </p>
          {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" disabled={salvando} className="bg-[#7030A0] hover:bg-[#5b2683] text-white">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar edição
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
