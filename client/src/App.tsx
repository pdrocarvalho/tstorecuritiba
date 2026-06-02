/**
 * client/src/App.tsx
 */
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";
import { isTokenPresent } from "@/lib/auth";
import { iniciarMonitorDeAtividade, sessaoExpirou } from "@/lib/activity";

import Home from "./pages/home/index";
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoHistorico from "./pages/recebimento/Historico";
import GestaoAvarias from "./pages/avarias/Avarias";
import RegistroDemandas from "./pages/demandas/RegistroDemandas";
import VincularArquivos from "./pages/configuracoes/VincularArquivos";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// 🛡️ PROTECTED ROUTE: Bloqueia acesso anônimo e verifica inatividade
const ProtectedRoute = ({ component: Component, path }: { component: any, path: string }) => {
  return (
    <Route path={path}>
      {() => {
        if (!isTokenPresent() || sessaoExpirou()) return <Redirect to="/login" />;
        return <Component />;
      }}
    </Route>
  );
};

// Monitor de inatividade — iniciado apenas quando logado
function ActivityMonitor() {
  const [location] = useLocation();
  const isLoggedIn = isTokenPresent();

  useEffect(() => {
    if (!isLoggedIn || location === "/login") return;
    const cleanup = iniciarMonitorDeAtividade();
    return cleanup;
  }, [isLoggedIn, location]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ActivityMonitor />
          <Switch>
            {/* Login — sempre acessível, nunca redireciona automaticamente */}
            <Route path="/login" component={Login} />

            {/* Rota raiz — protegida */}
            <ProtectedRoute path="/" component={Home} />
            <ProtectedRoute path={ROUTES.home} component={Home} />

            {/* Rotas protegidas */}
            <ProtectedRoute path={ROUTES.recebimento.produtos} component={RecebimentoProdutos} />
            <ProtectedRoute path={ROUTES.recebimento.historico} component={RecebimentoHistorico} />
            <ProtectedRoute path={ROUTES.avarias} component={GestaoAvarias} />
            <ProtectedRoute path="/demandas" component={RegistroDemandas} />
            <ProtectedRoute path="/configuracoes" component={VincularArquivos} />

            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}