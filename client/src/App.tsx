import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";

// Importações corretas baseadas na sua pasta 'recebimento'
import RecebimentoDashboard from "./pages/recebimento/Dashboard";
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoHistorico from "./pages/recebimento/Historico";
import RecebimentoConfig from "./pages/recebimento/Config";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* O Painel Principal é a página inicial */}
            <Route path="/" component={RecebimentoDashboard} />
            <Route path={ROUTES.home} component={RecebimentoDashboard} />
            
            <Route path="/login" component={Login} />
            
            {/* Rotas do Recebimento */}
            <Route path={ROUTES.recebimento.produtos} component={RecebimentoProdutos} />
            <Route path={ROUTES.recebimento.historico} component={RecebimentoHistorico} />
            <Route path={ROUTES.recebimento.config} component={RecebimentoConfig} />
            
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}