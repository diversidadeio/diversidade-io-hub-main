import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function InfoJuntaComercial() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button 
          type="button" 
          className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors ml-2 align-middle focus:outline-none focus:ring-2 focus:ring-purple-400" 
          title="Saiba mais sobre os documentos aceitos"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold mb-2" style={{ color: "#7030A0" }}>
            Tabela de Documentos por Tipo de Empresa
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="p-4 font-semibold text-gray-800 w-[35%] align-top">Porte / Tipo de Empresa</th>
                  <th className="p-4 font-semibold text-gray-800 align-top">Documento Correspondente (Equivalente ao Contrato Social)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900 align-top">MEI (Microempreendedor Individual)</td>
                  <td className="p-4 text-gray-700 align-top">
                    <strong>CCMEI</strong> (Certificado da Condição de Microempreendedor Individual). Este documento único tem força de contrato social e comprova a inscrição do CNPJ e Junta Comercial.
                  </td>
                </tr>
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900 align-top">Empresário Individual (EI)</td>
                  <td className="p-4 text-gray-700 align-top">
                    <strong>Requerimento de Empresário.</strong> Como não há sociedade (é apenas o titular), este é o documento registrado na Junta Comercial.
                  </td>
                </tr>
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900 align-top">ME, EPP ou Médio Porte (Sociedade Limitada - LTDA)</td>
                  <td className="p-4 text-gray-700 align-top">
                    <strong>Contrato Social.</strong> Empresas formadas por dois ou mais sócios (ou uma SLU - Sociedade Limitada Unipessoal, de um único sócio) utilizam o Contrato Social padrão registrado na Junta Comercial.
                  </td>
                </tr>
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900 align-top">ME, EPP ou Médio Porte (Sociedade Anônima - S.A.)</td>
                  <td className="p-4 text-gray-700 align-top">
                    <strong>Estatuto Social.</strong> Se a empresa for uma sociedade por ações (comum em empresas de médio a grande porte), o documento de fundação é o Estatuto Social, acompanhado da Ata de Assembleia.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
