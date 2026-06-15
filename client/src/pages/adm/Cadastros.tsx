import { LayoutAdm } from "@/components/adm/LayoutAdm";

export default function CadastrosAdm() {
  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastros</h1>
          <p className="text-gray-600 mt-1">Gerencie todas as empresas cadastradas na plataforma.</p>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">A lista completa de cadastros com busca e filtros será implementada aqui.</p>
        </div>
      </div>
    </LayoutAdm>
  );
}
