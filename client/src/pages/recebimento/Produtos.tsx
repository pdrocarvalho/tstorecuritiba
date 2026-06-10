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
  if (entregue) return { label: "Entregue", bg: "#dcfce7", text: "#16a34a", dot: "#16a34a" };
  if (!previsao) return { label: "Sem previsão", bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prev = new Date(previsao); prev.setHours(0, 0, 0, 0);
  const diff = Math.ceil((prev.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { label: `${Math.abs(diff)}d atrasado`, bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" };
  if (diff <= 7) return { label: `em ${diff}d`, bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" };
  return { label: formatarData(previsao), bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" };
};

export default function RecebimentoFuturo() {
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const isVinculado = !!urlPlanilha;

  const [busca, setBusca] = useState("");
  const [filtroMundo, setFiltroMundo] = useState("");
  const [filtroRemetente, setFiltroRemetente] = useState("");
  const [filtroTransportadora, setFiltroTransportadora] = useState("");
  const [filtroPrazo, setFiltroPrazo] = useState<"todos" | "atrasado" | "semana" | "ok">("todos");

  const { data: todosPedidos = [], refetch, isFetching } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: "recebimento" },
    { enabled: isVinculado }
  );

  useEffect(() => { if (isVinculado) refetch(); }, [isVinculado]);

  const { emTransito, mundos, remetentes, transportadoras, stats } = useMemo(() => {
    const em = (todosPedidos as any[]).filter(p => !p.dataEntrega);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em7 = new Date(hoje); em7.setDate(hoje.getDate() + 7);

    let atrasados = 0, semana = 0;
    em.forEach(p => {
      if (!p.previsaoEntrega) return;
      const prev = new Date(p.previsaoEntrega); prev.setHours(0, 0, 0, 0);
      if (prev < hoje) atrasados++;
      else if (prev <= em7) semana++;
    });

    return {
      emTransito: em,
      mundos: [...new Set(em.map((p: any) => String(p.mundo || "").toUpperCase().trim()).filter(Boolean))].sort(),
      remetentes: [...new Set(em.map((p: any) => p.remetente || "").filter(Boolean))].sort(),
      transportadoras: [...new Set(em.map((p: any) => p.transportadora || "").filter(Boolean))].sort(),
      stats: { total: em.length, atrasados, semana },
    };
  }, [todosPedidos]);

  const listaFiltrada = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em7 = new Date(hoje); em7.setDate(hoje.getDate() + 7);
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
          if (!p.previsaoEntrega) return filtroPrazo === "ok";
          const prev = new Date(p.previsaoEntrega); prev.setHours(0, 0, 0, 0);
          if (filtroPrazo === "atrasado" && prev >= hoje) return false;
          if (filtroPrazo === "semana" && (prev < hoje || prev > em7)) return false;
          if (filtroPrazo === "ok" && prev <= em7) return false;
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
      <style>@page{size:A4 portrait;margin:1cm}body{font-family:sans-serif;font-size:10px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:6px 4px;text-align:left}
      th{background:#eee;font-weight:bold;text-transform:uppercase}.header{display:flex;justify-content:space-between;border-bottom:2px solid #000;margin-bottom:15px;padding-bottom:5px}</style></head>
      <body><div class="header"><h1 style="margin:0;font-size:16px">T STORE — RECEBIMENTO FUTURO</h1><span>${new Date().toLocaleString("pt-BR")}</span></div>
      <table><thead><tr><th>Remetente</th><th>Transportadora</th><th>Ref.</th><th>Descrição</th><th>Mundo</th><th>NF</th><th>Previsão</th><th style="text-align:right">Volumes</th></tr></thead>
      <tbody>${listaFiltrada.map(p => `<tr>
        <td>${p.remetente || "—"}</td><td>${p.transportadora || "—"}</td>
        <td style="font-family:monospace">${p.produtoSku || "—"}</td><td>${p.descricao || "—"}</td>
        <td>${p.mundo || "—"}</td><td><b>${p.notaFiscal || "—"}</b></td>
        <td>${formatarData(p.previsaoEntrega)}</td><td style="text-align:right"><b>${p.volumesCaixas || 0}</b></td>
      </tr>`).join("")}</tbody></table>
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
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recebimento Futuro</h1>
            <p className="text-gray-500 mt-1">Mercadorias em trânsito — ordenadas por previsão de entrega</p>
          </div>
          {isVinculado && (
            <div className="flex gap-3">
              <button onClick={() => refetch()}
                className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg font-bold hover:bg-emerald-50 shadow-sm transition-colors text-sm">
                <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} /> Atualizar
              </button>
              <button onClick={gerarRelatorioImpressao}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors text-sm shadow-sm">
                <Printer size={16} /> Imprimir A4
              </button>
            </div>
          )}
        </div>

        {/* AVISO */}
        {!isVinculado && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 text-amber-800">
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
              <button onClick={() => setFiltroPrazo("todos")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${filtroPrazo === "todos" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Em Trânsito</p>
                <p className="text-4xl font-black text-slate-900 mt-1">{stats.total}</p>
                <p className="text-xs text-slate-400 mt-1">produtos sem data de entrega</p>
              </button>

              <button onClick={() => setFiltroPrazo(filtroPrazo === "atrasado" ? "todos" : "atrasado")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${filtroPrazo === "atrasado" ? "border-red-500 bg-red-50" : "border-slate-200 bg-white hover:border-red-200"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Atrasados</p>
                <p className={`text-4xl font-black mt-1 ${stats.atrasados > 0 ? "text-red-600" : "text-slate-900"}`}>{stats.atrasados}</p>
                <p className="text-xs text-slate-400 mt-1">previsão vencida</p>
              </button>

              <button onClick={() => setFiltroPrazo(filtroPrazo === "semana" ? "todos" : "semana")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${filtroPrazo === "semana" ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-200"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Esta Semana</p>
                <p className={`text-4xl font-black mt-1 ${stats.semana > 0 ? "text-amber-600" : "text-slate-900"}`}>{stats.semana}</p>
                <p className="text-xs text-slate-400 mt-1">chegando em até 7 dias</p>
              </button>
            </div>

            {/* FILTROS */}
            <Card className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <Input placeholder="Buscar por REF, descrição ou NF..." className="pl-9 text-sm"
                    value={busca} onChange={e => setBusca(e.target.value)} />
                </div>

                <select className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700 bg-white"
                  value={filtroMundo} onChange={e => setFiltroMundo(e.target.value)}>
                  <option value="">Todos os Mundos</option>
                  {mundos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <select className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700 bg-white"
                  value={filtroRemetente} onChange={e => setFiltroRemetente(e.target.value)}>
                  <option value="">Todos os Remetentes</option>
                  {remetentes.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700 bg-white"
                  value={filtroTransportadora} onChange={e => setFiltroTransportadora(e.target.value)}>
                  <option value="">Todas as Transportadoras</option>
                  {transportadoras.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {temFiltro && (
                  <button onClick={limparFiltros}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200">
                    <X size={14} /> Limpar
                  </button>
                )}
              </div>

              {temFiltro && (
                <p className="text-xs text-slate-400 mt-2 pl-1">
                  {listaFiltrada.length} de {emTransito.length} itens exibidos
                </p>
              )}
            </Card>

            {/* TABELA */}
            {listaFiltrada.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PackageOpen size={40} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum item encontrado</p>
                {temFiltro && (
                  <button onClick={limparFiltros} className="text-xs text-blue-600 font-bold hover:underline">
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <Card className="overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Remetente / Transportadora", "NF", "Ref.", "Descrição", "Qtde. Unitária", "Mundo", "Previsão"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {listaFiltrada.map((item: any, idx: number) => {
                        const badge = getPrazoBadge(item.previsaoEntrega, !!item.dataEntrega);
                        const corMundo = MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{item.remetente || "—"}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{item.transportadora || "—"}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">{item.notaFiscal || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                                {item.produtoSku || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[220px]">
                              <p className="text-slate-600 text-xs leading-snug truncate">{item.descricao || "—"}</p>
                            </td>
                            <td className="px-4 py-3 font-black text-slate-900">{item.quantidade || 0}</td>
                            <td className="px-4 py-3">
                              {item.mundo ? (
                                <span className="px-2 py-1 rounded text-[10px] font-black uppercase text-slate-900"
                                  style={{ backgroundColor: corMundo }}>
                                  {item.mundo}
                                </span>
                              ) : <span className="text-slate-400">—</span>}
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