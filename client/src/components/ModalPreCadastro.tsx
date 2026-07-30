import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileText, Image as ImageIcon, Building2, ListChecks } from "lucide-react";

interface ModalPreCadastroProps {
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalPreCadastro({ aberto, onOpenChange }: ModalPreCadastroProps) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900" style={{ color: "#7030A0" }}>
            Preparando seu Cadastro
          </DialogTitle>
          <DialogDescription>
            Bem-vindo, para agilizar o processo, faça um checklist e tenha em mãos os seguintes itens:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <ImageIcon className="w-5 h-5 text-purple-700" />
              </div>
              <div className="mt-1">
                <span className="text-gray-800 font-medium">Foto da pessoa</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-700" />
              </div>
              <div className="mt-1">
                <span className="text-gray-800 font-medium">Cartão do CNPJ</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-purple-700" />
              </div>
              <div className="mt-1">
                <span className="text-gray-800 font-medium">Contrato social ou certidão de inteiro teor</span>
              </div>
            </li>
            <li className="flex items-start gap-3 opacity-80">
              <div className="bg-gray-100 p-2 rounded-lg">
                <ImageIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="mt-1">
                <span className="text-gray-700 font-medium">Logo da empresa</span>
                <span className="text-gray-500 text-sm ml-2">(opcional)</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button asChild style={{ backgroundColor: "#7030A0" }} className="text-white hover:opacity-90">
            <Link href="/cadastro-gratuito" onClick={() => onOpenChange(false)}>
              Continuar
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
