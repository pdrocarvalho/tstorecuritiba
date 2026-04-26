/**
 * client/src/pages/home/index.tsx
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import TelaVisitante from "./TelaVisitante";
import PainelOperacoes from "./PainelOperacoes";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  // 🚀 INTERCEPTADOR DE TOKEN (O SALVA-VIDAS)
  // Pesca o token que o Google joga na URL e guarda no cofre do sistema
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Procura por ?token=... ou ?auth_token=... na URL
    const tokenNaUrl = params.get("token") || params.get("auth_token");

    if (tokenNaUrl) {
      // Guarda no cofre!
      localStorage.setItem("auth_token", tokenNaUrl);
      sessionStorage.setItem("auth_token", tokenNaUrl);
      
      // Limpa a URL e recarrega a página para o sistema te reconhecer logado
      window.location.replace("/"); 
    }
  }, []);

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