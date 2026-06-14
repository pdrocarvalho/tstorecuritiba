/**
 * client/src/components/layout/Sidebar.tsx
 */
import { Link, useLocation } from "wouter";
import { PackageSearch, CheckCircle, Store, LogOut, AlertOctagon, ClipboardList, Settings, ShieldCheck, User } from "lucide-react";
import { clearAuthToken } from "@/lib/auth";

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export default function Sidebar({ userName, userEmail, userRole }: SidebarProps) {
  const [location, setLocation] = useLocation();

  const menuItems = [
    { path: "/recebimento/produtos", label: "Recebimento Futuro", icon: PackageSearch },
    { path: "/recebimento/historico", label: "Histórico de Entregas", icon: CheckCircle },
    { path: "/demandas", label: "Registro de Demandas", icon: ClipboardList },
    { path: "/avarias", label: "Gestão de Avarias", icon: AlertOctagon },
    { path: "/configuracoes", label: "Configurações", icon: Settings },
  ];

  const handleLogout = () => {
    clearAuthToken();
    setLocation("/login");
  };

  const iniciais = userName
    ? userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <aside className="w-64 bg-[#050A15] border-r border-glass-border text-white/80 flex flex-col h-full shadow-xl z-20 flex-shrink-0">

      {/* Logotipo */}
      <Link href="/">
        <a className="h-16 flex items-center px-6 border-b border-glass-border bg-black/20 hover:bg-black/40 transition-colors cursor-pointer group">
          <Store className="text-brand-secondary mr-3 group-hover:scale-110 transition-transform" size={24} />
          <span className="text-lg font-bold text-white tracking-wide">
            T Store <span className="text-brand-secondary font-light">Admin</span>
          </span>
        </a>
      </Link>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5">
        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4 px-3">
          Menu Principal
        </div>

        {menuItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <a className={`flex items-center px-3 py-2.5 rounded-lg transition-colors group cursor-pointer ${
                isActive ? "bg-brand-primary/20 text-brand-secondary font-medium" : "hover:bg-glass hover:text-white"
              }`}>
                <Icon size={20} className={`mr-3 ${isActive ? "text-brand-secondary" : "text-white/40 group-hover:text-white/70"}`} />
                {item.label}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Perfil do usuário */}
      <div className="px-4 py-4 border-t border-glass-border space-y-3">
        <div className="flex items-center gap-3 px-1">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1A35A0, #89B4DE)" }}
          >
            {iniciais}
          </div>

          {/* Nome e role */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{userName || "Usuário"}</p>
            <p className="text-xs text-white/50 truncate">
              {userRole === "admin" ? "Administrador" : "Colaborador"}
            </p>
          </div>
        </div>

        {/* Botão sair */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-glass hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          <span className="text-sm font-medium">Sair do sistema</span>
        </button>

        <div className="text-xs text-slate-600 text-center">
          &copy; {new Date().getFullYear()} T Store
        </div>
      </div>
    </aside>
  );
}