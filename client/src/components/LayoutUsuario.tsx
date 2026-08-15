import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  Search,
  Users,
  LogOut,
  Moon,
  Sun,
  Settings,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoImage from "@/assets/logo.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ModalConfiguracoesPerfil } from "./ModalConfiguracoesPerfil";

interface LayoutUsuarioProps {
  children: ReactNode;
  activePath?: string;
}

export function LayoutUsuario({ children, activePath }: LayoutUsuarioProps) {
  const [location] = useLocation();
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const { logout, usuario, isPendente } = useAuth();
  const { theme, setTheme } = useTheme();

  const currentPath = activePath || location;

  const todosMenuItems = [
    {
      path: "/meu-cadastro/pesquisas",
      icon: Search,
      label: "Pesquisas",
      apenasAprovados: true,
    },
    {
      path: "/meu-cadastro/usuarios",
      icon: Users,
      label: "Usuários",
      apenasAprovados: true,
    },
    {
      path: "/meu-cadastro",
      icon: FileText,
      label: "Editar Cadastro",
    },
  ];

  // Filtra menu para empresas pendentes
  const menuItems = todosMenuItems.filter(item => !item.apenasAprovados || !isPendente);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sessão encerrada");
    } catch (error) {
      toast.error("Erro ao sair");
    }
  };

  const handleToggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    
    if (usuario?.id) {
      try {
        const { error } = await supabase
          .from("empresa_usuarios")
          .update({ tema_escuro: newTheme === "dark" })
          .eq("email", usuario.email);
        
        if (error) {
          console.error("Erro ao salvar preferência de tema:", error);
        }
      } catch (err) {
        console.error("Erro ao salvar preferência de tema:", err);
      }
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const nomeExibicao = (usuario as any)?.nome || usuario?.nome_responsavel || usuario?.email || "Usuário";
  const fotoExibicao = (usuario as any)?.fotoUrl || usuario?.foto_responsavel_url || null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 flex flex-col">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-6 sticky top-0 z-10 transition-colors duration-200">
        <Link href="/meu-cadastro">
          <a className="flex items-center gap-2">
            <img src={logoImage} alt="Diversidade.io" className="h-8" />
          </a>
        </Link>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 outline-none">
              <Avatar className="h-10 w-10 border-2 border-purple-100 dark:border-purple-900 cursor-pointer transition-transform hover:scale-105">
                <AvatarImage src={fotoExibicao || undefined} />
                <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 font-semibold">
                  {getInitials(nomeExibicao)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {nomeExibicao}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                  Configurações ▾
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 dark:bg-gray-800 dark:border-gray-700">
              <DropdownMenuLabel className="dark:text-gray-200">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-gray-700" />
              
              <DropdownMenuItem 
                onClick={handleToggleTheme}
                className="cursor-pointer flex items-center justify-between dark:text-gray-300 dark:focus:bg-gray-700"
              >
                <span className="flex items-center gap-2">
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  Modo {theme === "dark" ? "Claro" : "Escuro"}
                </span>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                className="cursor-pointer flex items-center gap-2 dark:text-gray-300 dark:focus:bg-gray-700"
                onClick={() => setModalPerfilAberto(true)}
              >
                <Settings className="w-4 h-4" /> Configurações
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="dark:bg-gray-700" />
              
              <DropdownMenuItem 
                onClick={handleLogout}
                className="cursor-pointer flex items-center gap-2 text-red-600 dark:text-red-400 dark:focus:bg-gray-700"
              >
                <LogOut className="w-4 h-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      <ModalConfiguracoesPerfil 
        aberto={modalPerfilAberto} 
        aoFechar={() => setModalPerfilAberto(false)} 
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden md:flex flex-col transition-colors duration-200">
          <nav className="p-4 space-y-1 flex-1">
            {menuItems.map((item) => {
              const isActive = currentPath === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <a
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-l-4 border-purple-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 border-l-4 border-transparent"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-500"}`} />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-red-400"
            >
              <LogOut className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-red-600 dark:group-hover:text-red-400" />
              Sair da Conta
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors duration-200 p-4 md:p-8">
          {/* Banner de cadastro em análise */}
          {isPendente && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Cadastro em análise</p>
                <p className="text-amber-700 text-sm mt-0.5">
                  Nossa equipe está analisando o seu cadastro. Em breve você receberá uma confirmação por e-mail quando o acesso for liberado.
                </p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
