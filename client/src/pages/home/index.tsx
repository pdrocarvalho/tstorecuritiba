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
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenNaUrl = params.get("token") || params.get("auth_token");

    if (tokenNaUrl) {
      localStorage.setItem("auth_token", tokenNaUrl);
      localStorage.setItem("token", tokenNaUrl); // Salva com ambos os nomes
      sessionStorage.setItem("auth_token", tokenNaUrl);
      window.location.replace("/"); 
    }
  }, []);

  // 1. Estado de Carregamento Principal
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  // 2. Verificação Dupla de Segurança
  // Verifica se o useAuth liberou OU se existe fisicamente o token salvo no navegador
  const temTokenNoCofre = !!localStorage.getItem("auth_token") || !!localStorage.getItem("token");
  const isLogged = isAuthenticated || temTokenNoCofre;

  // 3. Visitantes (Não Logados)
  if (!isLogged) {
    return <TelaVisitante />;
  }

  // 4. Utilizadores Logados
  return (
    <MainLayout>
      <PainelOperacoes userName={user?.name || "Equipe"} />
    </MainLayout>
  );
}