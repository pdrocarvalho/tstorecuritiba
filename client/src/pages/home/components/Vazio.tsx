import { PackageOpen } from "lucide-react";

export function Vazio() {
  return (
    <div className="flex flex-col items-center gap-2 py-10">
      <PackageOpen size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
        Nenhum dado disponível
      </p>
    </div>
  );
}
