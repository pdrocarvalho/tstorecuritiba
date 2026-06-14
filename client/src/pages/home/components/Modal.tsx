import { useEffect } from "react";
import { Package, FileText, Layers, Calendar, X } from "lucide-react";
import { Vazio } from "./Vazio";
import { MUNDO_COLORS } from "@/constants";

export type ModalTipo = "caixas" | "notas" | "skus" | "semana" | null;

export function Modal({ tipo, dados, onClose }: {
  tipo: ModalTipo;
  dados: any;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!tipo) return null;

  const configs: Record<NonNullable<ModalTipo>, { titulo: string; icone: any; cor: string }> = {
    caixas: { titulo: "Volumes por Remetente", icone: Package, cor: "#3b82f6" },
    notas:  { titulo: "Notas Fiscais Ativas",  icone: FileText, cor: "#8b5cf6" },
    skus:   { titulo: "SKUs por Mundo",         icone: Layers,   cor: "#10b981" },
    semana: { titulo: "Chegando esta Semana",   icone: Calendar, cor: "#f97316" },
  };

  const cfg = configs[tipo];
  const Icone = cfg.icone;

  const renderConteudo = () => {
    if (tipo === "caixas") {
      const entries = Object.entries(dados.volumesPorRemetente as Record<string, number>)
        .sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return <Vazio />;
      const max = entries[0][1];
      const total = entries.reduce((acc, [, v]) => acc + v, 0);
      return (
        <div className="space-y-5">
          {/* Resumo total */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                Total de volumes em trânsito
              </p>
              <p className="text-2xl font-black text-white mt-0.5">{total} <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>caixas</span></p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
              <Package size={20} style={{ color: "#3b82f6" }} />
            </div>
          </div>

          {/* Legenda */}
          <p className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
            Distribuição por remetente
          </p>

          {/* Barras por remetente */}
          {entries.map(([rem, vol]) => (
            <div key={rem} className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-white/80 uppercase">{rem}</span>
                <div className="text-right">
                  <span className="font-black text-white">{vol}</span>
                  <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>cx</span>
                  <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                    ({Math.round((vol / total) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(vol / max) * 100}%`, background: cfg.cor }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (tipo === "notas") {
      const notas = dados.listaNotas as any[];
      if (notas.length === 0) return <Vazio />;
      return (
        <div className="space-y-2">
          {notas.map((n: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="space-y-0.5">
                <p className="text-sm font-black text-white font-mono">{n.notaFiscal}</p>
                <p className="text-xs text-white/50 uppercase">{n.remetente}</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                {n.volumes} cx
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (tipo === "skus") {
      const entries = Object.entries(dados.skusPorMundo as Record<string, number>)
        .sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return <Vazio />;
      return (
        <div className="grid grid-cols-2 gap-3">
          {entries.map(([mundo, qtd]) => (
            <div key={mundo} className="flex flex-col items-center justify-center py-6 rounded-xl gap-2"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${MUNDO_COLORS[mundo] || "#fff"}33` }}>
              <div className="w-3 h-3 rounded-full" style={{ background: MUNDO_COLORS[mundo] || "#fff" }} />
              <span className="text-3xl font-black text-white">{qtd}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: MUNDO_COLORS[mundo] || "#fff" }}>{mundo}</span>
            </div>
          ))}
        </div>
      );
    }

    if (tipo === "semana") {
      const itens = dados.chegandoSemanaItens as any[];
      if (itens.length === 0) return <Vazio />;
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Nota Fiscal", "Remetente", "Transportadora", "Volumes"].map(h => (
                  <th key={h} className="text-left pb-3 pr-4 font-bold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {itens.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 font-black text-white font-mono">{item.notaFiscal || "—"}</td>
                  <td className="py-3 pr-4 text-white/70 uppercase">{item.remetente || "—"}</td>
                  <td className="py-3 pr-4 text-white/70 uppercase">{item.transportadora || "—"}</td>
                  <td className="py-3 font-bold text-white">{item.volumesCaixas || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "#0D1526",
          border: "1px solid rgba(255,255,255,0.1)",
          animation: "modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${cfg.cor}20` }}>
              <Icone size={18} style={{ color: cfg.cor }} />
            </div>
            <h3 className="font-black text-white text-base tracking-tight">{cfg.titulo}</h3>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {renderConteudo()}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
