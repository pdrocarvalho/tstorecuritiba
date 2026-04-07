/**
 * client/src/pages/Home.tsx
 *
 * Página inicial: exibe a tela de login para visitantes,
 * e uma central de boas-vindas com o MainLayout para utilizadores logados.
 */

import { Loader2, PackageOpen, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import MainLayout from "@/components/layout/MainLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ROUTES } from "@/constants";

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

  // 2. Visitantes (Não Logados) - Tela de Entrada
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md px-6 animate-in fade-in duration-700">
          <div className="bg-white p-4 rounded-full shadow-md w-fit mx-auto mb-6">
            <PackageOpen size={48} className="text-blue-600" />
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tight">ESTOQUE</h1>
          <p className="text-xl text-blue-600 font-semibold mt-2 uppercase tracking-widest">T Store Curitiba</p>
          <p className="text-gray-500 mt-4 mb-8 leading-relaxed">
            Plataforma inteligente de rastreamento de pedidos e notificações automáticas.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full text-lg h-12 shadow-lg">
              Fazer Login no Sistema
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // 3. Utilizadores Logados - Central de Boas-Vindas
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 animate-in zoom-in-95 duration-500">
        
        {/* Ícone de Boas Vindas */}
        <div className="bg-blue-100 text-blue-600 p-6 rounded-full mb-6 shadow-sm">
          <PackageOpen size={64} strokeWidth={1.5} />
        </div>

        {/* Mensagem Principal */}
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Olá, {user?.name?.split(" ")[0]}! 👋
        </h1>
        
        <p className="text-lg text-gray-600 max-w-2xl leading-relaxed mb-8">
          Bem-vindo(a) ao seu novo centro de comando. Agora você pode navegar por todas as funcionalidades do sistema utilizando o <strong>menu lateral à esquerda</strong>.
        </p>

        {/* Call to Action Rápida */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href={ROUTES.dashboard}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2 px-8">
              Ir para o Dashboard <ArrowRight size={18} />
            </Button>
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}