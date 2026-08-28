import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "@/pages/Home";
import CadastroGratuito from "@/pages/CadastroGratuito";
import Login from "@/pages/Login";
import PoliticaPrivacidade from "@/pages/PoliticaPrivacidade";
import TermosUso from "@/pages/TermosUso";
import MeuCadastro from "./pages/MeuCadastro";
import TrocarSenha from "./pages/TrocarSenha";
import DashboardAdm from "./pages/adm/Dashboard";
import CadastrosAdm from "./pages/adm/Cadastros";
import DetalhesCadastroAdm from "./pages/adm/DetalhesCadastro";
import ExclusoesAdm from "./pages/adm/Exclusoes";
import LogsAdm from "./pages/adm/Logs";
import AdministradoresAdm from "./pages/adm/Administradores";
import SolicitacoesBuscaAdm from "./pages/adm/SolicitacoesBusca";
import Pesquisas from "./pages/usuario/Pesquisas";
import MinhasSolicitacoes from "./pages/usuario/MinhasSolicitacoes";
import Usuarios from "./pages/usuario/Usuarios";
import EmpresaDetalhes from "./pages/usuario/EmpresaDetalhes";
import Oportunidade from "./pages/Oportunidade";
import { useAuth } from "./contexts/AuthContext";

function RotaProtegidaAdm({ component: Component, ...rest }: any) {
  const { isAdm, isCarregando, senhaTemporaria } = useAuth();
  
  if (isCarregando) return <div className="p-8 text-center">Carregando...</div>;
  
  if (!isAdm) {
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

// Wrapper para rotas que exigem aprovação de administrador
function RotaAprovada({ component: Component, ...rest }: any) {
  const { isLogado, senhaTemporaria, isPendente, isCarregando } = useAuth();
  
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

  if (isPendente) {
    return <Route {...rest} component={() => {
      window.location.href = "/meu-cadastro";
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
      <Route path={"/politica-de-privacidade"} component={PoliticaPrivacidade} />
      <Route path={"/termos-de-uso"} component={TermosUso} />

      {/* Página compartilhável de oportunidade — o bloqueio por login é feito dentro da página,
          para que o visitante veja um convite de acesso em vez de um redirecionamento seco. */}
      <Route path={"/oportunidades/:id"} component={Oportunidade} />
      
      {/* Rotas da Área do Usuário Logado */}
      <RotaProtegidaNormal path={"/meu-cadastro"} component={MeuCadastro} />
      <RotaAprovada path={"/meu-cadastro/pesquisas"} component={Pesquisas} />
      <RotaAprovada path={"/meu-cadastro/minhas-solicitacoes"} component={MinhasSolicitacoes} />
      <RotaAprovada path={"/meu-cadastro/usuarios"} component={Usuarios} />
      <RotaAprovada path={"/empresas/:id"} component={EmpresaDetalhes} />
      
      {/* Rotas ADM */}
      <RotaProtegidaAdm path={"/adm"} component={DashboardAdm} />
      <RotaProtegidaAdm path={"/adm/administradores"} component={AdministradoresAdm} />
      <RotaProtegidaAdm path={"/adm/cadastros"} component={CadastrosAdm} />
      <RotaProtegidaAdm path={"/adm/cadastros/:id"} component={DetalhesCadastroAdm} />
      <RotaProtegidaAdm path={"/adm/exclusoes"} component={ExclusoesAdm} />
      <RotaProtegidaAdm path={"/adm/solicitacoes-busca"} component={SolicitacoesBuscaAdm} />
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
