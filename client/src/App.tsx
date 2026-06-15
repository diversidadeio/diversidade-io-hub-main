import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import CadastroGratuito from "./pages/CadastroGratuito";
import Login from "./pages/Login";
import MeuCadastro from "./pages/MeuCadastro";
import TrocarSenha from "./pages/TrocarSenha";
import DashboardAdm from "./pages/adm/Dashboard";
import CadastrosAdm from "./pages/adm/Cadastros";
import ExclusoesAdm from "./pages/adm/Exclusoes";
import LogsAdm from "./pages/adm/Logs";
import { useAuth } from "./contexts/AuthContext";

// Wrapper para proteger rotas ADM
function RotaProtegidaAdm({ component: Component, ...rest }: any) {
  const { isAdm, isCarregando } = useAuth();
  
  if (isCarregando) return <div className="p-8 text-center">Carregando...</div>;
  
  if (!isAdm) {
    return <Route {...rest} component={() => {
      window.location.href = "/login";
      return null;
    }} />;
  }
  
  return <Route {...rest} component={Component} />;
}

// Wrapper para proteger rotas normais que não devem ser acessadas se a senha for temporária
function RotaProtegidaNormal({ component: Component, ...rest }: any) {
  const { isLogado, senhaTemporaria, isCarregando } = useAuth();
  
  if (isCarregando) return <div className="p-8 text-center">Carregando...</div>;
  
  if (!isLogado) {
    return <Route {...rest} component={() => {
      window.location.href = "/login";
      return null;
    }} />;
  }

  if (senhaTemporaria) {
    return <Route {...rest} component={() => {
      window.location.href = "/trocar-senha";
      return null;
    }} />;
  }
  
  return <Route {...rest} component={Component} />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/cadastro-gratuito"} component={CadastroGratuito} />
      <Route path={"/login"} component={Login} />
      <Route path={"/trocar-senha"} component={TrocarSenha} />
      <RotaProtegidaNormal path={"/meu-cadastro"} component={MeuCadastro} />
      
      {/* Rotas ADM */}
      <RotaProtegidaAdm path={"/adm"} component={DashboardAdm} />
      <RotaProtegidaAdm path={"/adm/cadastros"} component={CadastrosAdm} />
      <RotaProtegidaAdm path={"/adm/cadastros/:id"} component={() => <div className="p-8">Detalhes do Cadastro (Em desenvolvimento)</div>} />
      <RotaProtegidaAdm path={"/adm/exclusoes"} component={ExclusoesAdm} />
      <RotaProtegidaAdm path={"/adm/logs"} component={LogsAdm} />

      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
