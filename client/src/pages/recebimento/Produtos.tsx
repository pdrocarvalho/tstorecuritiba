/**
 * client/src/pages/recebimento/Produtos.tsx
 */
import { useState, useMemo, useEffect } from "react";
import {
  RefreshCw, AlertTriangle, Printer, Search,
  Clock, CheckCircle2, PackageOpen, X, Filter
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import { MUNDO_COLORS } from "@/constants";
import { Pedido } from "@/types";

const COR_PADRAO = "#94a3b8";

const formatarData = (dataStr?: string | Date | null) => {
  if (!dataStr) return "—";
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch { return "—"; }
};

const getPrazoBadge = (previsao: Date | null, entregue: boolean) => {
  if (entregue) return { label: "Entregue", bg: "rgba(34, 197, 94, 0.15)", text: "#4ade80", dot: "#22c55e" };
  if (!previsao) return { label: "Sem previsão", bg: "rgba(148, 163, 184, 0.15)", text: "#cbd5e1", dot: "#64748b" };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prev = new Date(previsao); prev.setHours(0, 0, 0, 0);
  const diff = Math.ceil((prev.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { label: `${Math.abs(diff)}d atrasado`, bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", dot: "#ef4444" };
  if (diff <= 7) return { label: `em ${diff}d`, bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", dot: "#f59e0b" };
  return { label: formatarData(previsao), bg: "rgba(34, 197, 94, 0.15)", text: "#4ade80", dot: "#22c55e" };
};

export default function RecebimentoFuturo() {
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const isVinculado = !!urlPlanilha;

  const [busca, setBusca] = useState("");
  const [filtroMundo, setFiltroMundo] = useState("");
  const [filtroRemetente, setFiltroRemetente] = useState("");
  const [filtroTransportadora, setFiltroTransportadora] = useState("");
  const [filtroPrazo, setFiltroPrazo] = useState<"todos" | "em_transito" | "atrasado" | "semana">("todos");

  const { data: todosPedidos = [], refetch, isFetching } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: "recebimento" },
    { enabled: isVinculado }
  );

  useEffect(() => { if (isVinculado) refetch(); }, [isVinculado]);

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const { emTransito, mundos, remetentes, transportadoras, stats } = useMemo(() => {
    const em = (todosPedidos as unknown as Pedido[]).filter(p => !p.dataEntrega);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    
    const startOfThisWeek = getStartOfWeek(hoje);
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(endOfThisWeek.getDate() + 6);
    endOfThisWeek.setHours(23, 59, 59, 999);

    let emTransitoCount = 0, atrasados = 0, semana = 0;

    em.forEach(p => {
      const vol = p.volumesCaixas !== undefined ? Number(p.volumesCaixas) : Number(p.quantidade || 0);

      if (p.dataEmbarque && !p.previsaoEntrega) {
        emTransitoCount += vol;
      }

      if (!p.previsaoEntrega) return;
      
      const prev = new Date(p.previsaoEntrega); 
      prev.setHours(0, 0, 0, 0);

      if (prev < hoje) {
        atrasados += vol;
      } else if (prev >= startOfThisWeek && prev <= endOfThisWeek) {
        semana += vol;
      }
    });

    return {
      emTransito: em,
      mundos: [...new Set(em.map((p: Pedido) => String(p.mundo || "").toUpperCase().trim()).filter(Boolean))].sort(),
      remetentes: [...new Set(em.map((p: Pedido) => p.remetente || "").filter(Boolean))].sort(),
      transportadoras: [...new Set(em.map((p: Pedido) => p.transportadora || "").filter(Boolean))].sort(),
      stats: { emTransitoCount, atrasados, semana },
    };
  }, [todosPedidos]);

  const listaFiltrada = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const startOfThisWeek = getStartOfWeek(hoje);
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(endOfThisWeek.getDate() + 6);
    endOfThisWeek.setHours(23, 59, 59, 999);
    
    const q = busca.toLowerCase();

    return emTransito
      .filter(p => {
        if (q && !String(p.produtoSku || "").toLowerCase().includes(q) &&
                  !String(p.descricao || "").toLowerCase().includes(q) &&
                  !String(p.notaFiscal || "").toLowerCase().includes(q)) return false;
        if (filtroMundo && String(p.mundo || "").toUpperCase().trim() !== filtroMundo) return false;
        if (filtroRemetente && p.remetente !== filtroRemetente) return false;
        if (filtroTransportadora && (p.transportadora || "") !== filtroTransportadora) return false;
        if (filtroPrazo !== "todos") {
          if (filtroPrazo === "em_transito") {
            return p.dataEmbarque && !p.previsaoEntrega;
          }
          if (!p.previsaoEntrega) return false;
          
          const prev = new Date(p.previsaoEntrega); prev.setHours(0, 0, 0, 0);
          if (filtroPrazo === "atrasado" && prev >= hoje) return false;
          if (filtroPrazo === "semana" && (prev < startOfThisWeek || prev > endOfThisWeek)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (!a.previsaoEntrega && !b.previsaoEntrega) return 0;
        if (!a.previsaoEntrega) return 1;
        if (!b.previsaoEntrega) return -1;
        return new Date(a.previsaoEntrega).getTime() - new Date(b.previsaoEntrega).getTime();
      });
  }, [emTransito, busca, filtroMundo, filtroRemetente, filtroTransportadora, filtroPrazo]);

  const temFiltro = busca || filtroMundo || filtroRemetente || filtroTransportadora || filtroPrazo !== "todos";
  const limparFiltros = () => {
    setBusca(""); setFiltroMundo(""); setFiltroRemetente("");
    setFiltroTransportadora(""); setFiltroPrazo("todos");
  };

  const gerarRelatorioImpressao = () => {
    if (listaFiltrada.length === 0) return toast.warning("Não há dados para imprimir.");
    const w = window.open("", "_blank");
    if (!w) return toast.error("Habilite popups.");
    w.document.write(`
      <html><head><title>Recebimento Futuro - T Store</title>
      <style>@page{size:A4 landscape;margin:1cm}body{font-family:sans-serif;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:6px 4px;text-align:left}
      th{background:#eee;font-weight:bold;text-transform:uppercase}.header{display:flex;justify-content:space-between;border-bottom:2px solid #000;margin-bottom:15px;padding-bottom:5px}</style></head>
      <body><div class="header"><h1 style="margin:0;font-size:16px">T STORE — RECEBIMENTO FUTURO</h1><span>${new Date().toLocaleString("pt-BR")}</span></div>
      <table><thead><tr><th>Remetente</th><th>Transportadora</th><th>NF</th><th>Ref.</th><th>Descrição</th><th style="text-align:right">Qtde. Unitária</th><th>Mundo</th><th>Previsão</th></tr></thead>
      <tbody>${listaFiltrada.map(p => {
        const badge = getPrazoBadge(p.previsaoEntrega ? new Date(p.previsaoEntrega) : null, !!p.dataEntrega);
        const corMundo = MUNDO_COLORS[(p.mundo || "").toUpperCase()] || COR_PADRAO;
        
        const badgeMundoHtml = p.mundo 
          ? \`<span style="background-color:\${corMundo};color:#000;padding:3px 6px;border-radius:4px;font-size:9px;font-weight:900;text-transform:uppercase;">\${p.mundo}</span>\`
          : \`—\`;
          
        const badgePrevisaoHtml = \`<span style="background-color:\${badge.bg};color:\${badge.text};padding:3px 8px;border-radius:12px;font-size:9px;font-weight:bold;display:inline-flex;align-items:center;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:\${badge.dot};margin-right:6px;"></span>\${badge.label}</span>\`;

        return \`<tr>
          <td>\${p.remetente || "—"}</td><td>\${p.transportadora || "—"}</td>
          <td><b>\${p.notaFiscal || "—"}</b></td><td style="font-family:monospace">\${p.produtoSku || "—"}</td>
          <td>\${p.descricao || "—"}</td><td style="text-align:right"><b>\${p.quantidade || 0}</b></td>
          <td style="text-align:center;">\${badgeMundoHtml}</td><td>\${badgePrevisaoHtml}</td>
        </tr>\`;
      }).join("")}</tbody></table>
      <script>setTimeout(()=>{window.print();window.close()},500)</script></body></html>
    `);
    w.document.close();
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">

        {/* CABEÇALHO */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Recebimento Futuro</h1>
            <p className="text-white/50 mt-1">Mercadorias em trânsito — ordenadas por previsão de entrega</p>
          </div>
          {isVinculado && (
            <div className="flex gap-3">
              <button onClick={() => refetch()}
                className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg font-bold hover:bg-emerald-500/20 shadow-sm transition-colors text-sm">
                <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} /> Atualizar
              </button>
              <button onClick={gerarRelatorioImpressao}
                className="flex items-center gap-2 bg-glass border border-glass-border text-white px-4 py-2 rounded-lg font-bold hover:bg-glass-hover transition-colors text-sm shadow-sm">
                <Printer size={16} /> Imprimir A4
              </button>
            </div>
          )}
        </div>

        {/* AVISO */}
        {!isVinculado && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle size={18} />
              <p className="text-sm font-bold">Fonte de dados não configurada.</p>
            </div>
            <Link href="/configuracoes">
              <button className="bg-amber-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-amber-700 transition-colors">
                Configurações
              </button>
            </Link>
          </div>
        )}

        {isVinculado && (
          <>
            {/* STATS */}
            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => setFiltroPrazo(filtroPrazo === "em_transito" ? "todos" : "em_transito")}
                className={`p-4 rounded-xl border border-glass-border text-left transition-all backdrop-blur-md ${filtroPrazo === "em_transito" ? "border-blue-500/50 bg-blue-500/10" : "bg-glass hover:bg-glass-hover hover:border-white/20"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Em Trânsito</p>
                <p className="text-4xl font-black text-white mt-1">{stats.emTransitoCount}</p>
                <p className="text-xs text-white/40 mt-1">volumes s/ previsão</p>
              </button>

              <button onClick={() => setFiltroPrazo(filtroPrazo === "atrasado" ? "todos" : "atrasado")}
                className={`p-4 rounded-xl border border-glass-border text-left transition-all backdrop-blur-md ${filtroPrazo === "atrasado" ? "border-red-500/50 bg-red-500/10" : "bg-glass hover:bg-glass-hover hover:border-red-500/30"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Atrasados</p>
                <p className={`text-4xl font-black mt-1 ${stats.atrasados > 0 ? "text-red-400" : "text-white"}`}>{stats.atrasados}</p>
                <p className="text-xs text-white/40 mt-1">previsão vencida</p>
              </button>

              <button onClick={() => setFiltroPrazo(filtroPrazo === "semana" ? "todos" : "semana")}
                className={`p-4 rounded-xl border border-glass-border text-left transition-all backdrop-blur-md ${filtroPrazo === "semana" ? "border-amber-500/50 bg-amber-500/10" : "bg-glass hover:bg-glass-hover hover:border-amber-500/30"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Esta Semana</p>
                <p className={`text-4xl font-black mt-1 ${stats.semana > 0 ? "text-amber-400" : "text-white"}`}>{stats.semana}</p>
                <p className="text-xs text-white/40 mt-1">previsão nesta semana</p>
              </button>
            </div>

            {/* FILTROS */}
            <Card className="p-4 bg-glass border-glass-border">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 text-white/40" size={15} />
                  <Input placeholder="Buscar por REF, descrição ou NF..." className="pl-9 text-sm bg-black/20 border-white/10 text-white placeholder:text-white/30"
                    value={busca} onChange={e => setBusca(e.target.value)} />
                </div>

                <select className="h-10 rounded-md border border-white/10 px-3 text-sm text-white bg-black/20 focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                  value={filtroMundo} onChange={e => setFiltroMundo(e.target.value)}>
                  <option value="" className="bg-[#0A0F1E]">Todos os Mundos</option>
                  {mundos.map(m => <option key={m} value={m} className="bg-[#0A0F1E]">{m}</option>)}
                </select>

                <select className="h-10 rounded-md border border-white/10 px-3 text-sm text-white bg-black/20 focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                  value={filtroRemetente} onChange={e => setFiltroRemetente(e.target.value)}>
                  <option value="" className="bg-[#0A0F1E]">Todos os Remetentes</option>
                  {remetentes.map(r => <option key={r} value={r} className="bg-[#0A0F1E]">{r}</option>)}
                </select>

                <select className="h-10 rounded-md border border-white/10 px-3 text-sm text-white bg-black/20 focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                  value={filtroTransportadora} onChange={e => setFiltroTransportadora(e.target.value)}>
                  <option value="" className="bg-[#0A0F1E]">Todas as Transportadoras</option>
                  {transportadoras.map(t => <option key={t} value={t} className="bg-[#0A0F1E]">{t}</option>)}
                </select>

                {temFiltro && (
                  <button onClick={limparFiltros}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-white/10">
                    <X size={14} /> Limpar
                  </button>
                )}
              </div>

              {temFiltro && (
                <p className="text-xs text-white/40 mt-2 pl-1">
                  {listaFiltrada.length} de {emTransito.length} itens exibidos
                </p>
              )}
            </Card>

            {/* TABELA */}
            {listaFiltrada.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PackageOpen size={40} className="text-white/20" />
                <p className="text-sm font-bold text-white/40 uppercase tracking-widest">Nenhum item encontrado</p>
                {temFiltro && (
                  <button onClick={limparFiltros} className="text-xs text-brand-secondary font-bold hover:underline">
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <Card className="overflow-hidden shadow-sm bg-glass border-glass-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/20 border-b border-glass-border">
                      <tr>
                        {["Remetente / Transportadora", "NF", "Ref.", "Descrição", "Qtde. Unitária", "Mundo", "Previsão"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/50">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/80">
                      {listaFiltrada.map((item: Pedido, idx: number) => {
                        const badge = getPrazoBadge(item.previsaoEntrega ? new Date(item.previsaoEntrega) : null, !!item.dataEntrega);
                        const corMundo = MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO;
                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{item.remetente || "—"}</p>
                              <p className="text-xs text-white/50 mt-0.5">{item.transportadora || "—"}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-white">{item.notaFiscal || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs bg-black/30 border border-white/5 px-2 py-1 rounded text-white/80">
                                {item.produtoSku || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[220px]">
                              <p className="text-white/80 text-xs leading-snug truncate">{item.descricao || "—"}</p>
                            </td>
                            <td className="px-4 py-3 font-black text-white">{item.quantidade || 0}</td>
                            <td className="px-4 py-3">
                              {item.mundo ? (
                                <span className="px-2 py-1 rounded text-[10px] font-black uppercase text-[#050A15]"
                                  style={{ backgroundColor: corMundo }}>
                                  {item.mundo}
                                </span>
                              ) : <span className="text-white/40">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                style={{ background: badge.bg, color: badge.text }}>
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: badge.dot }} />
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}