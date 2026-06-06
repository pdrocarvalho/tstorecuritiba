/**
 * client/src/pages/home/PainelOperacoes.tsx
 */
import { useState, useMemo, useEffect } from "react";
import {
  Package, FileText, Layers, Calendar,
  AlertTriangle, TrendingUp, RefreshCw,
  CheckCircle2, User, PackageOpen, Clock
} from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
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

function ListaConsultores({ porConsultor, cor }: {
  porConsultor: Record<string, number>;
  cor: "red" | "blue";
}) {
  const entries = Object.entries(porConsultor).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="w-full mt-2 space-y-1.5">
      {entries.map(([consultor, qtd]) => (
        <div key={consultor}
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
            cor === "red" ? "bg-red-50 text-red-700 border border-red-100" : "bg-blue-50 text-blue-700 border border-blue-100"
          }`}
        >
          <div className="flex items-center gap-1.5"><User size={11} /><span>{consultor}</span></div>
          <span className={`text-base font-black ${cor === "red" ? "text-red-600" : "text-blue-600"}`}>{qtd}</span>
        </div>
      ))}
    </div>
  );
}

export default function PainelOperacoes({ userName }: PainelOperacoesProps) {
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const [urlDemandas] = useState(() => localStorage.getItem("url_demandas") || "");
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
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em7Dias = new Date(hoje);
    em7Dias.setDate(hoje.getDate() + 7);

    const emTransito = (todosPedidos as any[]).filter(p => !p.dataEntrega);

    let totalCaixas = 0;
    const notasUnicas = new Set<string>();
    const skusUnicos = new Set<string>();
    let chegandoSemana = 0;
    const atrasados: any[] = [];

    emTransito.forEach(p => {
      totalCaixas += p.volumesCaixas || 0;
      if (p.notaFiscal) notasUnicas.add(String(p.notaFiscal).trim());
      if (p.produtoSku) skusUnicos.add(String(p.produtoSku).trim());

      if (p.previsaoEntrega) {
        const prev = new Date(p.previsaoEntrega);
        prev.setHours(0, 0, 0, 0);
        if (prev >= hoje && prev <= em7Dias) chegandoSemana++;
        if (prev < hoje) atrasados.push(p);
      }
    });

    return {
      totalCaixas,
      notasAtivas: notasUnicas.size,
      skusDiferentes: skusUnicos.size,
      chegandoSemana,
      atrasados,
    };
  }, [todosPedidos]);

  const renderCardContent = (
    temRegistros: boolean,
    count: number,
    porConsultor: Record<string, number>,
    cor: "red" | "blue"
  ) => {
    if (automacao.isPending) return (
      <p className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2 mt-4">
        <RefreshCw className={`animate-spin ${cor === "red" ? "text-red-500" : "text-blue-500"}`} size={16} />
        Lendo estoque...
      </p>
    );
    if (!temRegistros) return (
      <div className="flex flex-col items-center gap-2 mt-4">
        <PackageOpen size={28} className="text-slate-300" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center">Nenhum registro encontrado.</p>
      </div>
    );
    if (count === 0) return (
      <div className="flex flex-col items-center gap-1 mt-4">
        <CheckCircle2 size={28} className="text-green-400" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Nenhuma atualização hoje</p>
      </div>
    );
    return <ListaConsultores porConsultor={porConsultor} cor={cor} />;
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">

      {/* CABEÇALHO */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Olá, {userName?.split(" ")[0]}! 👋
        </h1>
        <p className="text-slate-500 font-medium">Visão geral do trânsito de mercadorias em tempo real.</p>
      </div>

      {/* AVISO DE CONFIGURAÇÃO */}
      {(!urlPlanilha || !urlDemandas) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={20} />
            <p className="text-sm font-bold">
              {!urlPlanilha && !urlDemandas ? "As fontes de dados do painel não foram configuradas."
                : !urlPlanilha ? "A fonte de dados de Recebimento Futuro não foi configurada."
                : "A fonte de dados de Demandas não foi configurada."}
            </p>
          </div>
          <Link href="/configuracoes">
            <button className="bg-amber-600 text-white hover:bg-amber-700 px-6 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
              Ir para Configurações
            </button>
          </Link>
        </div>
      )}

      {/* BLOCO 1: 4 KPIs PRINCIPAIS */}
      {isVinculado && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Caixas em Trânsito */}
          <Card className="p-6 flex flex-col gap-3 border-l-4 border-l-blue-600 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Caixas em Trânsito</span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Package size={18} className="text-blue-600" />
              </div>
            </div>
            <span className="text-5xl font-black text-slate-900">{kpis.totalCaixas}</span>
            <span className="text-xs text-slate-400">volumes sem data de entrega</span>
          </Card>

          {/* Notas Fiscais Ativas */}
          <Card className="p-6 flex flex-col gap-3 border-l-4 border-l-violet-600 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notas Fiscais Ativas</span>
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <FileText size={18} className="text-violet-600" />
              </div>
            </div>
            <span className="text-5xl font-black text-slate-900">{kpis.notasAtivas}</span>
            <span className="text-xs text-slate-400">notas únicas em aberto</span>
          </Card>

          {/* SKUs Diferentes */}
          <Card className="p-6 flex flex-col gap-3 border-l-4 border-l-emerald-600 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SKUs Diferentes</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Layers size={18} className="text-emerald-600" />
              </div>
            </div>
            <span className="text-5xl font-black text-slate-900">{kpis.skusDiferentes}</span>
            <span className="text-xs text-slate-400">referências únicas em trânsito</span>
          </Card>

          {/* Chegando esta Semana */}
          <Card className="p-6 flex flex-col gap-3 border-l-4 border-l-orange-500 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chegando esta Semana</span>
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <Calendar size={18} className="text-orange-500" />
              </div>
            </div>
            <span className="text-5xl font-black text-slate-900">{kpis.chegandoSemana}</span>
            <span className="text-xs text-slate-400">previsão nos próximos 7 dias</span>
          </Card>

        </div>
      )}

      {/* BLOCO 2: ALERTA DE ATRASO */}
      {isVinculado && kpis.atrasados.length > 0 && (
        <div className="rounded-xl border-2 border-red-200 overflow-hidden shadow-sm">
          <div className="bg-red-600 text-white px-5 py-3 flex items-center gap-3">
            <Clock size={18} />
            <span className="font-black uppercase tracking-widest text-sm">
              {kpis.atrasados.length} {kpis.atrasados.length === 1 ? "Entrega Atrasada" : "Entregas Atrasadas"}
            </span>
            <span className="ml-auto text-xs text-red-200 font-medium">Previsão vencida sem data de entrega</span>
          </div>
          <div className="bg-white divide-y divide-red-50">
            {kpis.atrasados.slice(0, 5).map((p: any, idx: number) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 flex-shrink-0">
                    {p.produtoSku || "-"}
                  </span>
                  <span className="text-sm text-slate-600 truncate">{p.descricao || "-"}</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-500">
                  <span>{p.remetente || "-"}</span>
                  <span className="font-bold text-red-600">
                    Prev: {p.previsaoEntrega ? new Date(p.previsaoEntrega).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-"}
                  </span>
                </div>
              </div>
            ))}
            {kpis.atrasados.length > 5 && (
              <div className="px-5 py-2 text-center">
                <Link href="/recebimento/produtos">
                  <span className="text-xs text-red-600 font-bold cursor-pointer hover:underline">
                    Ver todos os {kpis.atrasados.length} itens atrasados →
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLOCO 3: ALERTAS E DEMANDAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Card className="p-0 overflow-hidden border-2 border-red-200 shadow-sm flex flex-col">
          <div className="bg-red-100 text-red-700 text-center py-3 text-xs font-black uppercase tracking-widest border-b border-red-200 flex items-center justify-center gap-2">
            <AlertTriangle size={16} /> Alerta de Demanda
          </div>
          <div className="p-5 bg-white flex-1 flex flex-col items-center gap-2">
            {!urlDemandas ? (
              <p className="text-sm font-bold text-slate-400 uppercase mt-4">Planilha não vinculada</p>
            ) : renderCardContent(
                resultadoAutomacao.alertasTemRegistros,
                resultadoAutomacao.alertas,
                resultadoAutomacao.alertasPorConsultor,
                "red"
              )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden border-2 border-blue-200 shadow-sm flex flex-col">
          <div className="bg-blue-100 text-blue-700 text-center py-3 text-xs font-black uppercase tracking-widest border-b border-blue-200 flex items-center justify-center gap-2">
            <TrendingUp size={16} /> Venda Futura
          </div>
          <div className="p-5 bg-white flex-1 flex flex-col items-center gap-2">
            {!urlDemandas ? (
              <p className="text-sm font-bold text-slate-400 uppercase mt-4">Planilha não vinculada</p>
            ) : renderCardContent(
                resultadoAutomacao.vendasTemRegistros,
                resultadoAutomacao.vendas,
                resultadoAutomacao.vendasPorConsultor,
                "blue"
              )}
          </div>
        </Card>

      </div>
    </div>
  );
}