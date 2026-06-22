/**
 * client/src/pages/home/PainelOperacoes.tsx
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Package, FileText, Layers, Calendar,
  AlertTriangle, TrendingUp, RefreshCw,
  CheckCircle2, Clock, Truck, PackageOpen,
  AlertOctagon, ClipboardCheck
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Modal, ModalTipo } from "./components/Modal";
import { KpiCard } from "./components/KpiCard";
import { ListaConsultores } from "./components/ListaConsultores";
import { Pedido } from "@/types";
import { useAvarias } from "@/_core/hooks/useAvarias";
import { useMinhasTarefas } from "@/_core/hooks/useTarefas";

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

import { ConflictModal } from "./components/ConflictModal";

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function PainelOperacoes({ userName }: PainelOperacoesProps) {
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const [urlDemandas] = useState(() => localStorage.getItem("url_demandas") || "");
  const [urlAvarias] = useState(() => localStorage.getItem("url_avarias") || "");
  const [modalAberto, setModalAberto] = useState<ModalTipo>(null);
  const [conflitosLogistica, setConflitosLogistica] = useState<any[]>([]);
  const isVinculado = !!urlPlanilha;

  const { data: todosPedidos = [] } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' },
    { enabled: isVinculado, refetchInterval: 60000 }
  );

  const { avarias = [] } = useAvarias(urlAvarias);

  const dataHojeStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const { tarefas = [] } = useMinhasTarefas(dataHojeStr);

  const [resultadoAutomacao, setResultadoAutomacao] = useState<ResultadoAutomacao>({
    alertas: 0, alertasPorConsultor: {}, alertasTemRegistros: false,
    vendas: 0, vendasPorConsultor: {}, vendasTemRegistros: false,
  });

  const automacao = trpc.notifications.rodarAutomacaoDemandas.useMutation({
    onSuccess: (data: any) => {
      if (!data.success) return;
      if (data.conflitos && data.conflitos.length > 0) {
        setConflitosLogistica(data.conflitos);
      }
      
      // We will only set the automation results if it was fully successful without manual pauses, 
      // or we can just ignore the count visualization if there are conflicts.
      if (data.alertasNotificados !== undefined) {
        setResultadoAutomacao({
          alertas: data.alertasNotificados ?? 0,
          alertasPorConsultor: data.alertasPorConsultor ?? {},
          alertasTemRegistros: data.alertasTemRegistros ?? false,
          vendas: data.vendasNotificadas ?? 0,
          vendasPorConsultor: data.vendasPorConsultor ?? {},
          vendasTemRegistros: data.vendasTemRegistros ?? false,
        });
      }
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
    const emTransito = (todosPedidos as unknown as Pedido[]).filter(p => !p.dataEntrega);

    let totalCaixas = 0;
    const notasMap = new Map<string, { notaFiscal: string; remetente: string; volumes: number }>();
    const skusPorMundo: Record<string, number> = {};
    const volumesPorRemetente: Record<string, number> = {};
    const skusUnicos = new Set<string>();
    const chegandoSemanaItens: Pedido[] = [];
    const atrasados: Pedido[] = [];

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
        new Date(a.previsaoEntrega || "").getTime() - new Date(b.previsaoEntrega || "").getTime()
      ),
      atrasados,
    };
  }, [todosPedidos]);

  const metricasAvarias = useMemo(() => {
    let pendentes = 0;
    let resolvidasTotal = 0;
    avarias.forEach((a: any) => {
      const tratativa = String(a.TRATATIVA || "").toUpperCase();
      if (tratativa !== "CONCLUÍDA") {
        pendentes++;
      } else {
        resolvidasTotal++;
      }
    });
    return { pendentes, resolvidasTotal };
  }, [avarias]);

  const metricasTarefas = useMemo(() => {
    const total = tarefas.length;
    let concluidas = 0;
    tarefas.forEach((t: any) => {
      if (t.task?.status === "concluida" || t.task?.status === "nao_aplicavel") {
        concluidas++;
      }
    });
    const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    const pendentes = total - concluidas;
    return { progresso, pendentes, total, concluidas };
  }, [tarefas]);

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

      {/* 4 KPIs - RECEBIMENTO */}
      {isVinculado && (
        <>
          <h2 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-widest">Recebimento</h2>
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
        </>
      )}

      {/* KPIs - AVARIAS E TAREFAS */}
      <h2 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-widest">Avarias e Tarefas Diárias</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {urlAvarias ? (
          <>
            <KpiCard label="Avarias Pendentes" valor={metricasAvarias.pendentes}
              descricao="aguardando finalização" cor="#ef4444"
              icone={AlertOctagon} onClick={() => {}} />
            <KpiCard label="Avarias Resolvidas" valor={metricasAvarias.resolvidasTotal}
              descricao="total no sistema" cor="#10b981"
              icone={CheckCircle2} onClick={() => {}} />
          </>
        ) : (
          <div className="col-span-2 p-4 rounded-xl flex items-center justify-between"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div className="flex items-center gap-3" style={{ color: "#fbbf24" }}>
              <AlertTriangle size={18} />
              <p className="text-sm font-bold">Fonte de Avarias não configurada.</p>
            </div>
            <Link href="/configuracoes">
              <button className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                Configurar
              </button>
            </Link>
          </div>
        )}

        <KpiCard label="Progresso Diário" valor={`${metricasTarefas.progresso}%`}
          descricao={`${metricasTarefas.concluidas} de ${metricasTarefas.total} concluídas`} cor="#3b82f6"
          icone={ClipboardCheck} onClick={() => {}} />
        <KpiCard label="Tarefas Pendentes" valor={metricasTarefas.pendentes}
          descricao="para finalizar hoje" cor="#f59e0b"
          icone={Clock} onClick={() => {}} />
      </div>

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
            {kpis.atrasados.slice(0, 5).map((p: Pedido, idx: number) => (
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
      <h2 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-widest mt-8">Demandas e Alertas</h2>
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