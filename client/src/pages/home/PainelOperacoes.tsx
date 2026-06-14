/**
 * client/src/pages/home/PainelOperacoes.tsx
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Package, FileText, Layers, Calendar,
  AlertTriangle, TrendingUp, RefreshCw,
  CheckCircle2, User, PackageOpen, Clock,
  X, ChevronRight, Truck
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

const AUTOMACAO_INTERVALO_MS = 60 * 60 * 1000;
const AUTOMACAO_STORAGE_KEY = "automacao_ultima_execucao";

interface PainelOperacoesProps {
  userName?: string;
}

interface ResultadoAutomacao {
  alertas: number;
  alertasPorConsultor: Record<string, number>;
  alertasTemRegistros: boolean;
  vendas: number;
  vendasPorConsultor: Record<string, number>;
  vendasTemRegistros: boolean;
}

type ModalTipo = "caixas" | "notas" | "skus" | "semana" | null;

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ tipo, dados, onClose }: {
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
      const CORES_MUNDO: Record<string, string> = {
        "CORTAR": "#fca5a5", "EQUIPAR": "#93c5fd",
        "FESTEJAR": "#c4b5fd", "PREPARAR": "#86efac", "SERVIR": "#fde047"
      };
      if (entries.length === 0) return <Vazio />;
      return (
        <div className="grid grid-cols-2 gap-3">
          {entries.map(([mundo, qtd]) => (
            <div key={mundo} className="flex flex-col items-center justify-center py-6 rounded-xl gap-2"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CORES_MUNDO[mundo] || "#fff"}33` }}>
              <div className="w-3 h-3 rounded-full" style={{ background: CORES_MUNDO[mundo] || "#fff" }} />
              <span className="text-3xl font-black text-white">{qtd}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: CORES_MUNDO[mundo] || "#fff" }}>{mundo}</span>
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

function Vazio() {
  return (
    <div className="flex flex-col items-center gap-2 py-10">
      <PackageOpen size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
        Nenhum dado disponível
      </p>
    </div>
  );
}

// ─── CARD KPI ─────────────────────────────────────────────────────────────────
function KpiCard({ label, valor, descricao, cor, icone: Icone, onClick }: {
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

// ─── CARD DEMANDA ──────────────────────────────────────────────────────────────
function ListaConsultores({ porConsultor, cor }: {
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
          style={{ background: bg, border: `1px solid ${border}`, color: textColor }}>
          <div className="flex items-center gap-1.5">
            <User size={11} /><span>{consultor}</span>
          </div>
          <span className="text-base font-black">{qtd}</span>
        </div>
      ))}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function PainelOperacoes({ userName }: PainelOperacoesProps) {
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const [urlDemandas] = useState(() => localStorage.getItem("url_demandas") || "");
  const [modalAberto, setModalAberto] = useState<ModalTipo>(null);
  const isVinculado = !!urlPlanilha;

  const { data: todosPedidos = [] } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' },
    { enabled: isVinculado, refetchInterval: 60000 }
  );

  const [resultadoAutomacao, setResultadoAutomacao] = useState<ResultadoAutomacao>({
    alertas: 0, alertasPorConsultor: {}, alertasTemRegistros: false,
    vendas: 0, vendasPorConsultor: {}, vendasTemRegistros: false,
  });

  const automacao = trpc.notifications.rodarAutomacaoDemandas.useMutation({
    onSuccess: (data: any) => {
      if (!data.success) return;
      setResultadoAutomacao({
        alertas: data.alertasNotificados ?? 0,
        alertasPorConsultor: data.alertasPorConsultor ?? {},
        alertasTemRegistros: data.alertasTemRegistros ?? false,
        vendas: data.vendasNotificadas ?? 0,
        vendasPorConsultor: data.vendasPorConsultor ?? {},
        vendasTemRegistros: data.vendasTemRegistros ?? false,
      });
    }
  });

  useEffect(() => {
    if (!urlPlanilha || !urlDemandas) return;
    const ultimaExecucao = localStorage.getItem(AUTOMACAO_STORAGE_KEY);
    const agora = Date.now();
    if (ultimaExecucao && agora - parseInt(ultimaExecucao) < AUTOMACAO_INTERVALO_MS) return;
    automacao.mutate(
      { urlRecebimento: urlPlanilha, urlDemandas },
      { onSuccess: () => localStorage.setItem(AUTOMACAO_STORAGE_KEY, String(agora)) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPlanilha, urlDemandas]);

  const kpis = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em7Dias = new Date(hoje); em7Dias.setDate(hoje.getDate() + 7);
    const emTransito = (todosPedidos as any[]).filter(p => !p.dataEntrega);

    let totalCaixas = 0;
    const notasMap = new Map<string, { notaFiscal: string; remetente: string; volumes: number }>();
    const skusPorMundo: Record<string, number> = {};
    const volumesPorRemetente: Record<string, number> = {};
    const skusUnicos = new Set<string>();
    const chegandoSemanaItens: any[] = [];
    const atrasados: any[] = [];

    emTransito.forEach(p => {
      totalCaixas += p.volumesCaixas || 0;

      if (p.notaFiscal) {
        const nf = String(p.notaFiscal).trim();
        if (!notasMap.has(nf)) {
          notasMap.set(nf, { notaFiscal: nf, remetente: p.remetente || "—", volumes: 0 });
        }
        notasMap.get(nf)!.volumes += p.volumesCaixas || 0;
      }

      if (p.produtoSku) skusUnicos.add(String(p.produtoSku).trim());

      const mundo = String(p.mundo || "").toUpperCase().trim();
      if (mundo) skusPorMundo[mundo] = (skusPorMundo[mundo] || 0) + 1;

      const rem = String(p.remetente || "Desconhecido").trim();
      volumesPorRemetente[rem] = (volumesPorRemetente[rem] || 0) + (p.volumesCaixas || 0);

      if (p.previsaoEntrega) {
        const prev = new Date(p.previsaoEntrega); prev.setHours(0, 0, 0, 0);
        if (prev >= hoje && prev <= em7Dias) chegandoSemanaItens.push(p);
        if (prev < hoje) atrasados.push(p);
      }
    });

    return {
      totalCaixas,
      notasAtivas: notasMap.size,
      listaNotas: Array.from(notasMap.values()).sort((a, b) => b.volumes - a.volumes),
      skusDiferentes: skusUnicos.size,
      skusPorMundo,
      volumesPorRemetente,
      chegandoSemana: chegandoSemanaItens.length,
      chegandoSemanaItens: chegandoSemanaItens.sort((a, b) =>
        new Date(a.previsaoEntrega).getTime() - new Date(b.previsaoEntrega).getTime()
      ),
      atrasados,
    };
  }, [todosPedidos]);

  const fecharModal = useCallback(() => setModalAberto(null), []);

  const renderDemandaCard = (
    temRegistros: boolean, count: number,
    porConsultor: Record<string, number>, cor: "red" | "blue"
  ) => {
    const corBg = cor === "red" ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)";
    const corBorder = cor === "red" ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)";
    if (automacao.isPending) return (
      <p className="text-xs font-bold uppercase flex items-center gap-2 mt-4" style={{ color: "rgba(255,255,255,0.4)" }}>
        <RefreshCw className={`animate-spin`} size={14} style={{ color: cor === "red" ? "#f87171" : "#60a5fa" }} />
        Processando...
      </p>
    );
    if (!temRegistros) return (
      <div className="flex flex-col items-center gap-2 mt-4">
        <PackageOpen size={24} style={{ color: "rgba(255,255,255,0.2)" }} />
        <p className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
          Nenhum registro
        </p>
      </div>
    );
    if (count === 0) return (
      <div className="flex flex-col items-center gap-1 mt-4">
        <CheckCircle2 size={24} className="text-green-400" />
        <p className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
          Sem atualizações hoje
        </p>
      </div>
    );
    return <ListaConsultores porConsultor={porConsultor} cor={cor} />;
  };

  return (
    <div className="min-h-full pb-12 animate-in fade-in duration-500"
      style={{ background: "#0A0F1E", margin: "-32px", padding: "32px" }}>

      {/* CABEÇALHO */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Olá, {userName?.split(" ")[0]}! 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Visão geral do trânsito de mercadorias em tempo real.
        </p>
      </div>

      {/* AVISO */}
      {(!urlPlanilha || !urlDemandas) && (
        <div className="mb-8 p-4 rounded-xl flex items-center justify-between"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div className="flex items-center gap-3" style={{ color: "#fbbf24" }}>
            <AlertTriangle size={18} />
            <p className="text-sm font-bold">
              {!urlPlanilha && !urlDemandas ? "As fontes de dados não foram configuradas."
                : !urlPlanilha ? "Fonte de Recebimento Futuro não configurada."
                : "Fonte de Demandas não configurada."}
            </p>
          </div>
          <Link href="/configuracoes">
            <button className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
              style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
              Configurações
            </button>
          </Link>
        </div>
      )}

      {/* 4 KPIs */}
      {isVinculado && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Caixas em Trânsito" valor={kpis.totalCaixas}
            descricao="volumes sem data de entrega" cor="#3b82f6"
            icone={Package} onClick={() => setModalAberto("caixas")} />
          <KpiCard label="Notas Fiscais Ativas" valor={kpis.notasAtivas}
            descricao="notas únicas em aberto" cor="#8b5cf6"
            icone={FileText} onClick={() => setModalAberto("notas")} />
          <KpiCard label="SKUs Diferentes" valor={kpis.skusDiferentes}
            descricao="referências únicas em trânsito" cor="#10b981"
            icone={Layers} onClick={() => setModalAberto("skus")} />
          <KpiCard label="Chegando esta Semana" valor={kpis.chegandoSemana}
            descricao="notas fiscais nos próximos 7 dias" cor="#f97316"
            icone={Calendar} onClick={() => setModalAberto("semana")} />
        </div>
      )}

      {/* ALERTA DE ATRASO */}
      {isVinculado && kpis.atrasados.length > 0 && (
        <div className="mb-8 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
          <div className="px-5 py-3 flex items-center gap-3"
            style={{ background: "rgba(239,68,68,0.15)" }}>
            <Clock size={16} style={{ color: "#f87171" }} />
            <span className="font-black uppercase tracking-widest text-sm" style={{ color: "#f87171" }}>
              {kpis.atrasados.length} {kpis.atrasados.length === 1 ? "Entrega Atrasada" : "Entregas Atrasadas"}
            </span>
            <span className="ml-auto text-xs" style={{ color: "rgba(239,68,68,0.6)" }}>
              Previsão vencida sem data de entrega
            </span>
          </div>
          <div style={{ background: "#0D1526" }}>
            {kpis.atrasados.slice(0, 5).map((p: any, idx: number) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between gap-4"
                style={{ borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs px-2 py-1 rounded flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                    {p.produtoSku || "—"}
                  </span>
                  <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {p.descricao || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>{p.remetente || "—"}</span>
                  <span className="font-bold" style={{ color: "#f87171" }}>
                    {p.previsaoEntrega ? new Date(p.previsaoEntrega).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                  </span>
                </div>
              </div>
            ))}
            {kpis.atrasados.length > 5 && (
              <div className="px-5 py-2 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <Link href="/recebimento/produtos">
                  <span className="text-xs font-bold cursor-pointer" style={{ color: "#f87171" }}>
                    Ver todos os {kpis.atrasados.length} itens atrasados →
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CARDS DE DEMANDA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="rounded-2xl overflow-hidden" style={{ background: "#0D1526", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="px-5 py-3 flex items-center justify-center gap-2"
            style={{ borderBottom: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.08)" }}>
            <AlertTriangle size={14} style={{ color: "#f87171" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#f87171" }}>
              Alerta de Demanda
            </span>
          </div>
          <div className="p-5 flex flex-col items-center gap-2 min-h-[120px] justify-center">
            {!urlDemandas
              ? <p className="text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Planilha não vinculada</p>
              : renderDemandaCard(resultadoAutomacao.alertasTemRegistros, resultadoAutomacao.alertas, resultadoAutomacao.alertasPorConsultor, "red")}
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: "#0D1526", border: "1px solid rgba(59,130,246,0.2)" }}>
          <div className="px-5 py-3 flex items-center justify-center gap-2"
            style={{ borderBottom: "1px solid rgba(59,130,246,0.15)", background: "rgba(59,130,246,0.08)" }}>
            <TrendingUp size={14} style={{ color: "#60a5fa" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#60a5fa" }}>
              Venda Futura
            </span>
          </div>
          <div className="p-5 flex flex-col items-center gap-2 min-h-[120px] justify-center">
            {!urlDemandas
              ? <p className="text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Planilha não vinculada</p>
              : renderDemandaCard(resultadoAutomacao.vendasTemRegistros, resultadoAutomacao.vendas, resultadoAutomacao.vendasPorConsultor, "blue")}
          </div>
        </div>

      </div>

      {/* MODAL */}
      <Modal
        tipo={modalAberto}
        dados={kpis}
        onClose={fecharModal}
      />
    </div>
  );
}