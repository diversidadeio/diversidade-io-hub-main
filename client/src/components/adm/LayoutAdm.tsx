import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, FileText, Activity, LogOut, Shield, Send, Menu, X, Mail } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutAdmProps {
  children: ReactNode;
}

export function LayoutAdm({ children }: LayoutAdmProps) {
  const [location] = useLocation();
  const { logout, usuario } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha o menu lateral ao trocar de página no mobile
  useEffect(() => { setMenuAberto(false); }, [location]);

  const links = [
    { href: "/adm", label: "Dashboard", icon: LayoutDashboard },
    { href: "/adm/administradores", label: "Administradores", icon: Shield },
    { href: "/adm/cadastros", label: "Cadastros", icon: Users },
    { href: "/adm/exclusoes", label: "Exclusões", icon: FileText },
    { href: "/adm/solicitacoes-busca", label: "Solicitações de Busca", icon: Send },
    // { href: "/adm/email-marketing", label: "E-mail Marketing", icon: Mail },
    { href: "/adm/logs", label: "Logs de Acesso", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay do menu no mobile */}
      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer no mobile, fixa a partir de lg */}
      <aside
        className={`w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-30 shadow-sm transition-transform duration-200 lg:translate-x-0 ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <img src={logoImage} alt="Diversidade.io" className="h-8" />
          <span className="font-bold text-[#7030A0] text-lg">Admin</span>
          <button
            onClick={() => setMenuAberto(false)}
            className="ml-auto text-gray-400 hover:text-gray-700 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
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
                  <Icon className="w-5 h-5 flex-shrink-0" />
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

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col">
        {/* Barra superior — só aparece no mobile */}
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-200 h-16 px-4 flex items-center gap-3">
          <button
            onClick={() => setMenuAberto(true)}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={logoImage} alt="Diversidade.io" className="h-7" />
          <span className="font-bold text-[#7030A0]">Admin</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
