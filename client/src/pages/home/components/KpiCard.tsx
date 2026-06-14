import { ChevronRight } from "lucide-react";

export function KpiCard({ label, valor, descricao, cor, icone: Icone, onClick }: {
  label: string; valor: number; descricao: string;
  cor: string; icone: any; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left w-full group" style={{ outline: "none" }}>
      <div
        className="relative p-6 rounded-2xl flex flex-col gap-4 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl cursor-pointer overflow-hidden"
        style={{
          background: "#0D1526",
          border: "1px solid rgba(255,255,255,0.07)",
          borderLeftWidth: "3px",
          borderLeftColor: cor,
        }}
      >
        {/* Glow sutil no hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
          style={{ background: `radial-gradient(ellipse at top left, ${cor}15, transparent 70%)` }} />

        <div className="flex items-start justify-between relative z-10">
          <span className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: `${cor}18` }}>
              <Icone size={16} style={{ color: cor }} />
            </div>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-300"
              style={{ color: cor }} />
          </div>
        </div>

        <span className="text-5xl font-black text-white relative z-10 tabular-nums">{valor}</span>

        <span className="text-[11px] relative z-10" style={{ color: "rgba(255,255,255,0.35)" }}>
          {descricao}
        </span>
      </div>
    </button>
  );
}
