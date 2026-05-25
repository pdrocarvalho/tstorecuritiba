/**
 * client/src/pages/home/index.tsx
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { isTokenPresent, setAuthToken } from "@/lib/auth";
import TelaVisitante from "./TelaVisitante";
import PainelOperacoes from "./PainelOperacoes";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  // Interceptador de token via URL (ex: redirecionamentos externos)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenNaUrl = params.get("token") || params.get("auth_token");

    if (tokenNaUrl) {
      setAuthToken(tokenNaUrl);
      window.location.replace("/");
    }
  }, []);

  // 1. Estado de carregamento
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  // 2. Verifica se está logado
  const isLogged = isAuthenticated || isTokenPresent();

  // 3. Visitantes (não logados)
  if (!isLogged) {
    return <TelaVisitante />;
  }

  // 4. Usuários logados
  return (
    <MainLayout>
      <PainelOperacoes userName={user?.name || "Equipe"} />
    </MainLayout>
  );
}