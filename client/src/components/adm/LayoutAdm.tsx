import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, FileText, Activity, LogOut } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutAdmProps {
  children: ReactNode;
}

export function LayoutAdm({ children }: LayoutAdmProps) {
  const [location] = useLocation();
  const { logout, usuario } = useAuth();

  const links = [
    { href: "/adm", label: "Dashboard", icon: LayoutDashboard },
    { href: "/adm/cadastros", label: "Cadastros", icon: Users },
    { href: "/adm/exclusoes", label: "Exclusões", icon: FileText },
    { href: "/adm/logs", label: "Logs de Acesso", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <img src={logoImage} alt="Diversidade.io" className="h-8" />
          <span className="font-bold text-[#7030A0] text-lg">Admin</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/adm" && location.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <a className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  isActive 
                    ? "bg-purple-50 text-[#7030A0] border border-purple-100" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}>
                  <Icon className="w-5 h-5" />
                  {link.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="px-4 py-3 mb-2 rounded-xl bg-gray-50">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Logado como</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{usuario?.email}</p>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
