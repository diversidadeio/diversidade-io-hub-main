import { LayoutAdm } from "@/components/adm/LayoutAdm";

export default function LogsAdm() {
  return (
    <LayoutAdm>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs de Acesso</h1>
          <p className="text-gray-600 mt-1">Trilha de auditoria de acessos para conformidade LGPD.</p>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">O histórico completo de logins, logouts e falhas será listado aqui.</p>
        </div>
      </div>
    </LayoutAdm>
  );
}
