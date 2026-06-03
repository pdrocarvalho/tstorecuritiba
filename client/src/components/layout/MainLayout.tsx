/**
 * client/src/components/layout/MainLayout.tsx
 */
import { ReactNode } from "react";
import { useLocation } from "wouter";
import Sidebar from "./Sidebar";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearAuthToken } from "@/lib/auth";
import { LogOut } from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Painel de Operações",
  "/recebimento/produtos": "Recebimento Futuro",
  "/recebimento/historico": "Histórico de Entregas",
  "/demandas": "Registro de Demandas",
  "/avarias": "Gestão de Avarias",
  "/configuracoes": "Configurações do Sistema",
};

export default function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const pageTitle = PAGE_TITLES[location] || "Sistema de Gestão de Estoque";
  const primeiroNome = user?.name?.split(" ")[0] || "Usuário";
  const iniciais = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar userName={user?.name} userEmail={user?.email} userRole={user?.role} />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Barra de Topo */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm flex-shrink-0 z-10">
          {/* Título da página atual */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 font-medium">T Store</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-700">{pageTitle}</span>
          </div>

          {/* Usuário logado */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-700 leading-none">{primeiroNome}</p>
              <p className="text-xs text-slate-400 mt-0.5">{user?.role === "admin" ? "Administrador" : "Colaborador"}</p>
            </div>

            {/* Avatar com iniciais */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shadow-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1A35A0, #89B4DE)" }}
            >
              {iniciais}
            </div>

            {/* Logout rápido */}
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Conteúdo das páginas */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}