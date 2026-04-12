import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";

import Login from "./pages/Login";
import UploadExcel from "./pages/UploadExcel";
import NotFound from "./pages/NotFound";

// Módulo de Recebimento
import RecebimentoDashboard from "./pages/Dashboard"; // <--- CAMINHO CORRIGIDO AQUI!
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoHistorico from "./pages/recebimento/Historico";
import RecebimentoConfig from "./pages/recebimento/Config";

function AppRouter() {
  return (
    <Switch>
      {/* A Rota Home ("/") agora carrega a nossa Visão Geral inteligente */}
      <Route path={ROUTES.home} component={RecebimentoDashboard} />
      
      {/* Outras rotas globais */}
      <Route path="/login" component={Login} />
      <Route path={ROUTES.upload} component={UploadExcel} />
      
      {/* Rotas das Abas do Menu */}
      <Route path={ROUTES.recebimento.produtos} component={RecebimentoProdutos} />
      <Route path={ROUTES.recebimento.historico} component={RecebimentoHistorico} />
      <Route path={ROUTES.recebimento.config} component={RecebimentoConfig} />
      
      {/* Rota 404 para links inválidos */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}