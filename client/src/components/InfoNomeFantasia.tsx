import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InfoNomeFantasia() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button 
          type="button" 
          className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors ml-2 align-middle focus:outline-none focus:ring-2 focus:ring-purple-400" 
          title="O que preencher caso não tenha nome fantasia?"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold mb-2" style={{ color: "#7030A0" }}>
            Nome Fantasia
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 text-gray-700 leading-relaxed">
          Caso a sua empresa não possua um <strong>Nome Fantasia</strong> registrado, você deve preencher este campo utilizando a sua <strong>Razão Social</strong>.
        </div>
      </DialogContent>
    </Dialog>
  );
}
