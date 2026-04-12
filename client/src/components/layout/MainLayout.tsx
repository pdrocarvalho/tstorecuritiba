/**
 * client/src/components/layout/MainLayout.tsx
 */

import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Menu Lateral Fixo */}
      <Sidebar />

      {/* Área de Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Barra de Topo (Opcional, podes adicionar o nome do utilizador ou notificações aqui depois) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shadow-sm flex-shrink-0 z-10">
          <div className="text-sm font-medium text-slate-500">
            Sistema de Gestão de Estoque
          </div>
        </header>

        {/* Onde as páginas (Dashboard, Configurações, etc.) são renderizadas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}