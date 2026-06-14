import { User } from "lucide-react";

export function ListaConsultores({ porConsultor, cor }: {
  porConsultor: Record<string, number>;
  cor: "red" | "blue";
}) {
  const entries = Object.entries(porConsultor).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const bg = cor === "red" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)";
  const border = cor === "red" ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)";
  const textColor = cor === "red" ? "#fca5a5" : "#93c5fd";
  
  return (
    <div className="w-full mt-2 space-y-1.5">
      {entries.map(([consultor, qtd]) => (
        <div key={consultor}
          className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold uppercase"
          style={{ background: bg, border: `1px solid ${border}` }}>
          <span style={{ color: textColor }}>{consultor}</span>
          <span className="text-white font-black px-1.5 rounded" style={{ background: border }}>{qtd}</span>
        </div>
      ))}
    </div>
  );
}
