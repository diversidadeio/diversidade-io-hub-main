import { LayoutAdm } from "@/components/adm/LayoutAdm";

export default function ExclusoesAdm() {
  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Solicitações de Exclusão</h1>
          <p className="text-gray-600 mt-1">Gerencie os pedidos de exclusão de dados baseados na LGPD.</p>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">A fila de solicitações pendentes e histórico de exclusões será exibida aqui.</p>
        </div>
      </div>
    </LayoutAdm>
  );
}
