/**
 * client/src/components/layout/Sidebar.tsx
 */

import { Link, useLocation } from "wouter";
import { LayoutDashboard, PackageSearch, CheckCircle, Settings, Store } from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();

  // Caso os teus caminhos de rota sejam diferentes no teu ficheiro App.tsx,
  // basta ajustares a propriedade 'path' aqui.
  const menuItems = [
    { 
      path: "/", 
      label: "Visão Geral", 
      icon: LayoutDashboard 
    },
    { 
      path: "/recebimento/produtos", 
      label: "Recebimento Futuro", 
      icon: PackageSearch 
    },
    { 
      path: "/recebimento/historico", 
      label: "Histórico de Entregas", 
      icon: CheckCircle 
    },
    { 
      path: "/recebimento/config", 
      label: "Configurações", 
      icon: Settings 
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shadow-xl z-20 flex-shrink-0">
      {/* Logotipo / Título */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
        <Store className="text-blue-500 mr-3" size={24} />
        <span className="text-lg font-bold text-white tracking-wide">
          T Store <span className="text-blue-500 font-light">Admin</span>
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">
          Menu Principal
        </div>
        
        {menuItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex items-center px-3 py-2.5 rounded-lg transition-colors group cursor-pointer ${
                  isActive
                    ? "bg-blue-600/10 text-blue-400 font-medium"
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon
                  size={20}
                  className={`mr-3 ${
                    isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                {item.label}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé do Menu */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        &copy; {new Date().getFullYear()} T Store
      </div>
    </aside>
  );
}