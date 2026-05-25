/**
 * client/src/App.tsx
 */
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";
import { isTokenPresent } from "@/lib/auth";

import Home from "./pages/home/index";
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoHistorico from "./pages/recebimento/Historico";
import GestaoAvarias from "./pages/avarias/Avarias";
import RegistroDemandas from "./pages/demandas/RegistroDemandas";
import VincularArquivos from "./pages/configuracoes/VincularArquivos";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// 🛡️ PROTECTED ROUTE: Bloqueia acesso anônimo
const ProtectedRoute = ({ component: Component, path }: { component: any, path: string }) => {
  return (
    <Route path={path}>
      {() => (isTokenPresent() ? <Component /> : <Redirect to="/login" />)}
    </Route>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* Rotas públicas */}
            <Route path="/login" component={Login} />

            {/* Rota raiz */}
            <Route path="/" component={Home} />
            <Route path={ROUTES.home} component={Home} />

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
