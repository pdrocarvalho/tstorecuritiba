/**
 * client/src/pages/Home.tsx
 *
 * Página inicial: redireciona usuários autenticados para o dashboard
 * e exibe a tela de boas-vindas para visitantes.
 */

import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ROUTES } from "@/constants";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md px-6">
          <h1 className="text-5xl font-bold text-gray-900">ESTOQUE</h1>
          <p className="text-2xl text-gray-700 mt-2">T Store Curitiba</p>
          <p className="text-lg text-gray-500 mt-3 mb-8">
            Sistema de Rastreamento e Notificação de Pedidos
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full">
              Fazer Login
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-5 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            ESTOQUE — T Store Curitiba
          </h1>
          <span className="text-sm text-gray-600">
            Bem-vindo, <strong>{user?.name ?? "Usuário"}</strong>
          </span>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-6xl mx-auto px-8 py-12 w-full space-y-10">
        {/* Cards de acesso rápido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <QuickAccessCard
            emoji="📊"
            title="Dashboard de Pedidos"
            description="Visualize todos os pedidos, status de notificação e previsões de entrega em tempo real."
            linkTo={ROUTES.dashboard}
            linkLabel="Ir para Dashboard"
          />
          <QuickAccessCard
            emoji="📁"
            title="Sincronizar Dados"
            description="Sincronize o Google Sheets com o banco de dados e dispare notificações automaticamente."
            linkTo={ROUTES.upload}
            linkLabel="Sincronizar Agora"
          />
        </div>

        {/* Sobre o sistema */}
        <section className="bg-blue-50 p-8 rounded-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Sobre o Sistema</h2>
          <p className="text-gray-700 mb-4">
            O ESTOQUE é um sistema inteligente de rastreamento que sincroniza
            automaticamente com o Google Sheets, agrupa notificações por cliente e
            consultor, e envia alertas por e-mail nas três fases críticas do pedido.
          </p>
          <ul className="space-y-2 text-gray-700 text-sm list-disc list-inside">
            <li>Sincronização automática de dados via Google Sheets</li>
            <li>Notificações inteligentes agrupadas por cliente e consultor</li>
            <li>Rastreamento em tempo real: Faturado → Previsto → Chegou</li>
            <li>Dashboard com métricas, KPIs e filtros avançados</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

// =============================================================================
// COMPONENTE INTERNO
// =============================================================================

interface QuickAccessCardProps {
  emoji: string;
  title: string;
  description: string;
  linkTo: string;
  linkLabel: string;
}

function QuickAccessCard({
  emoji,
  title,
  description,
  linkTo,
  linkLabel,
}: QuickAccessCardProps) {
  return (
    <div className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{emoji}</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>
      <p className="text-gray-600 mb-6">{description}</p>
      <Link href={linkTo}>
        <Button className="w-full">{linkLabel}</Button>
      </Link>
    </div>
  );
}
