/**
 * client/src/App.tsx
 */

import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";

// Importações corretas baseadas na nossa nova arquitetura
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoHistorico from "./pages/recebimento/Historico";
import GestaoAvarias from "./pages/avarias/Avarias"; // 🚀 1. Importação da nova página
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* A Nova Sala de Controle (Recebimento Futuro) agora é a página inicial exata */}
            <Route path="/" component={RecebimentoProdutos} />
            <Route path={ROUTES.home} component={RecebimentoProdutos} />
            
            <Route path="/login" component={Login} />
            
            {/* Rotas do Recebimento */}
            <Route path={ROUTES.recebimento.produtos} component={RecebimentoProdutos} />
            <Route path={ROUTES.recebimento.historico} component={RecebimentoHistorico} />
            
            {/* 🚀 2. ROTA INDEPENDENTE DE AVARIAS */}
            <Route path={ROUTES.avarias} component={GestaoAvarias} />
            
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}