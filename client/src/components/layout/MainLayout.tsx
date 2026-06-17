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
  "/tarefas": "Tarefas da Equipe",
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
    <div className="flex h-screen bg-brand-dark text-white overflow-hidden font-sans">
      <Sidebar userName={user?.name ?? undefined} userEmail={user?.email} userRole={user?.role} />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Barra de Topo */}
        <header className="h-16 bg-glass border-b border-glass-border flex items-center justify-between px-8 shadow-sm flex-shrink-0 z-10 backdrop-blur-md">
          {/* Título da página atual */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/50 font-medium">T Store</span>
            <span className="text-white/20">/</span>
            <span className="text-sm font-semibold text-white/90">{pageTitle}</span>
          </div>

          {/* Usuário logado */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white leading-none">{primeiroNome}</p>
              <p className="text-xs text-white/50 mt-0.5">{user?.role === "admin" ? "Administrador" : "Colaborador"}</p>
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
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
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