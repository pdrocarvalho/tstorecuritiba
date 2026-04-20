/**
 * client/src/App.tsx
 */

import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";

// Importações das páginas
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoHistorico from "./pages/recebimento/Historico";
import GestaoAvarias from "./pages/avarias/Avarias";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

/**
 * 🔒 COMPONENTE GUARDIÃO (ProtectedRoute)
 * Ele verifica se o usuário está autenticado antes de renderizar a página.
 */
const ProtectedRoute = ({ component: Component, path }: { component: any, path: string }) => {
  // Busca o token em ambos os storages (conforme configurado no login)
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");

  return (
    <Route path={path}>
      {() => (token ? <Component /> : <Redirect to="/login" />)}
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
            {/* 🚪 PORTA PÚBLICA (Login) */}
            <Route path="/login" component={Login} />
            
            {/* 🛡️ ROTAS PROTEGIDAS (Só entra com Token) */}
            <ProtectedRoute path="/" component={RecebimentoProdutos} />
            <ProtectedRoute path={ROUTES.home} component={RecebimentoProdutos} />
            
            {/* Rotas do Recebimento */}
            <ProtectedRoute path={ROUTES.recebimento.produtos} component={RecebimentoProdutos} />
            <ProtectedRoute path={ROUTES.recebimento.historico} component={RecebimentoHistorico} />
            
            {/* Gestão de Avarias */}
            <ProtectedRoute path={ROUTES.avarias} component={GestaoAvarias} />
            
            {/* Caso nenhuma rota bata */}
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}