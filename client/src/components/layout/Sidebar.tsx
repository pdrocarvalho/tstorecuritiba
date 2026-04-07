/**
 * client/src/components/layout/Sidebar.tsx
 *
 * Menu lateral fixo com suporte a submenus expansíveis.
 * Responsivo: ocultável em mobile via toggle.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  ChevronDown, 
  LogOut, 
  Package, 
  Menu, 
  X, 
  Settings,
  User
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import { useAuth } from "@/_core/hooks/useAuth";

// =============================================================================
// TIPOS E CONFIGURAÇÃO DO MENU
// =============================================================================

interface SubmenuItem {
  label: string;
  path: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  submenu: SubmenuItem[];
}

// Aqui definimos a nova estrutura pensada para a melhor UX
const MENU_ITEMS: MenuItem[] = [
  {
    id: "recebimento",
    label: "Recebimento Futuro",
    icon: Package,
    submenu: [
      { label: "Dashboard", path: ROUTES.dashboard },
      { label: "Listagem", path: ROUTES.recebimento.produtos },
      { label: "Relatórios e KPI's", path: ROUTES.recebimento.kpis },
      { label: "Sincronizar Sheets", path: ROUTES.upload },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    icon: Settings,
    submenu: [
      { label: "Configurações", path: ROUTES.recebimento.config },
    ],
  }
];

// =============================================================================
// COMPONENTE
// =============================================================================

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // Mantemos o "recebimento" aberto por defeito para facilitar o acesso
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["recebimento"]);
  const [location] = useLocation();
  const { user } = useAuth(); // Fomos buscar os dados do utilizador logado!

  const logoutMutation = trpc.auth.logout.useMutation();

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  const isActive = (path: string) => location === path;

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logout realizado com sucesso.");
      window.location.href = ROUTES.home;
    } catch {
      // Como fallback de segurança, limpamos o local storage e forçamos a saída
      localStorage.removeItem("token");
      window.location.href = ROUTES.home;
    }
  };

  return (
    <>
      {/* Botão toggle para Telemóveis */}
      <button
        aria-label="Abrir menu"
        onClick={() => setIsMobileOpen((prev) => !prev)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Principal */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-xl md:shadow-none
          transition-transform duration-300 z-40 flex flex-col
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Cabeçalho da Marca */}
        <div className="p-6 border-b border-gray-100 flex flex-col items-center justify-center bg-blue-50/50">
          <h1 className="text-2xl font-black text-blue-700 tracking-tight">ESTOQUE</h1>
          <p className="text-xs text-blue-600/80 font-medium uppercase tracking-widest mt-1">T Store Curitiba</p>
        </div>

        {/* Árvore de Navegação */}
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {MENU_ITEMS.map((menu) => {
            const Icon = menu.icon;
            const isExpanded = expandedMenus.includes(menu.id);

            return (
              <div key={menu.id}>
                <button
                  onClick={() => toggleMenu(menu.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    isExpanded ? "bg-gray-50 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isExpanded ? "text-blue-600" : "text-gray-400"} />
                    <span className="font-semibold text-sm">{menu.label}</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Submenus */}
                <div
                  className={`overflow-hidden transition-all duration-200 ease-in-out ${
                    isExpanded ? "max-h-64 opacity-100 mt-1" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="ml-4 space-y-1 border-l-2 border-gray-100 pl-3 py-1">
                    {menu.submenu.map((item) => (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive(item.path)
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                        onClick={() => setIsMobileOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Rodapé — Perfil e Logout */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          {/* Info do Utilizador Logado */}
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
              <User size={18} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">
                {user?.name || "Carregando..."}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role || "Usuário"}
              </p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            disabled={logoutMutation.isPending}
          >
            <LogOut size={16} />
            {logoutMutation.isPending ? "Saindo..." : "Sair do Sistema"}
          </Button>
        </div>
      </aside>

      {/* Overlay para Telemóveis (clicar fora fecha o menu) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}