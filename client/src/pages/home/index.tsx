/**
 * client/src/pages/home/index.tsx
 */
import { Loader2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import TelaVisitante from "./TelaVisitante";
import PainelOperacoes from "./PainelOperacoes";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  // 1. Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  // 2. Visitantes (Não Logados)
  if (!isAuthenticated) {
    return <TelaVisitante />;
  }

  // 3. Utilizadores Logados
  return (
    <MainLayout>
      <PainelOperacoes userName={user?.name} />
    </MainLayout>
  );
}