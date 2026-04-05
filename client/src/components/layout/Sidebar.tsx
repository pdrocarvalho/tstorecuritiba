/**
 * client/src/components/layout/Sidebar.tsx
 *
 * Menu lateral fixo com suporte a submenus expansíveis.
 * Responsivo: ocultável em mobile via toggle.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, LogOut, Package, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ROUTES } from "@/constants";

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

const MENU_ITEMS: MenuItem[] = [
  {
    id: "recebimento",
    label: "Recebimento Futuro",
    icon: Package,
    submenu: [
      { label: "Lista de Produtos", path: ROUTES.recebimento.produtos },
      { label: "Índices / KPI's", path: ROUTES.recebimento.kpis },
      { label: "Configurações", path: ROUTES.recebimento.config },
    ],
  },
];

// =============================================================================
// COMPONENTE
// =============================================================================

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["recebimento"]);
  const [location] = useLocation();

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
      toast.error("Erro ao fazer logout. Tente novamente.");
    }
  };

  return (
    <>
      {/* Botão toggle mobile */}
      <button
        aria-label="Abrir menu"
        onClick={() => setIsMobileOpen((prev) => !prev)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-blue-600 text-white"
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-lg
          transition-transform duration-300 z-40 flex flex-col
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Cabeçalho */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">ESTOQUE</h1>
          <p className="text-xs text-gray-500 mt-1">T Store Curitiba</p>
        </div>

        {/* Itens de menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {MENU_ITEMS.map((menu) => {
            const Icon = menu.icon;
            const isExpanded = expandedMenus.includes(menu.id);

            return (
              <div key={menu.id}>
                <button
                  onClick={() => toggleMenu(menu.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg
                    hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-blue-600" />
                    <span className="font-medium text-gray-800">{menu.label}</span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-gray-500 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-2 ml-4 space-y-1 border-l-2 border-gray-200 pl-4">
                    {menu.submenu.map((item) => (
                      <Link
  key={item.path}
  href={item.path}
  className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
    isActive(item.path)
      ? "bg-blue-100 text-blue-600 font-medium"
      : "text-gray-700 hover:bg-gray-100"
  }`}
  onClick={() => setIsMobileOpen(false)}
>
  {item.label}
</Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rodapé — Logout */}
        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            disabled={logoutMutation.isPending}
          >
            <LogOut size={18} />
            {logoutMutation.isPending ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
