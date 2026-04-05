import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "./constants";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UploadExcel from "./pages/UploadExcel";
import RecebimentoProdutos from "./pages/recebimento/Produtos";
import RecebimentoKPIs from "./pages/recebimento/KPIs";
import RecebimentoConfig from "./pages/recebimento/Config";
import NotFound from "./pages/NotFound";

function AppRouter() {
  return (
    <Switch>
      <Route path={ROUTES.home} component={Home} />
      <Route path="/login" component={Login} />
      <Route path={ROUTES.dashboard} component={Dashboard} />
      <Route path={ROUTES.upload} component={UploadExcel} />
      <Route path={ROUTES.recebimento.produtos} component={RecebimentoProdutos} />
      <Route path={ROUTES.recebimento.kpis} component={RecebimentoKPIs} />
      <Route path={ROUTES.recebimento.config} component={RecebimentoConfig} />
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