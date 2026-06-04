/**
 * client/src/pages/home/PainelOperacoes.tsx
 */
import { useState, useMemo, useEffect } from "react";
import { Box, Globe, AlertTriangle, TrendingUp, RefreshCw, CheckCircle2, User, PackageOpen } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MUNDO_COLORS, FABRICAS_FIXAS, MUNDOS_FIXOS } from "@/constants";

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
        <div
          key={consultor}
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
            cor === "red"
              ? "bg-red-50 text-red-700 border border-red-100"
              : "bg-blue-50 text-blue-700 border border-blue-100"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <User size={11} />
            <span>{consultor}</span>
          </div>
          <span className={`text-base font-black ${cor === "red" ? "text-red-600" : "text-blue-600"}`}>
            {qtd}
          </span>
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
    alertas: 0,
    alertasPorConsultor: {},
    alertasTemRegistros: false,
    vendas: 0,
    vendasPorConsultor: {},
    vendasTemRegistros: false,
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
      {
        onSuccess: () => {
          localStorage.setItem(AUTOMACAO_STORAGE_KEY, String(agora));
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPlanilha, urlDemandas]);

  const kpis = useMemo(() => {
    if (!isVinculado) return { caixasPorFabrica: {}, skusPorMundo: {} };

    const futuros = (todosPedidos as any[]).filter((p) => !p.dataEntrega);

    const caixasPorFabrica: Record<string, number> = {};
    const skusPorMundo: Record<string, Set<string>> = {};

    FABRICAS_FIXAS.forEach(f => caixasPorFabrica[f] = 0);
    MUNDOS_FIXOS.forEach(m => skusPorMundo[m] = new Set());

    futuros.forEach(p => {
      const remetente = String(p.remetente || "").toUpperCase();
      const fabricaMatch = FABRICAS_FIXAS.find(f => remetente.includes(f));
      const qtdeCaixas = p.volumesCaixas !== undefined ? p.volumesCaixas : (p.quantidade || 0);

      if (fabricaMatch) {
        caixasPorFabrica[fabricaMatch] += qtdeCaixas;
      } else {
        caixasPorFabrica["DELTA"] = (caixasPorFabrica["DELTA"] || 0) + qtdeCaixas;
      }

      const mundo = String(p.mundo || "").toUpperCase().trim();
      if (MUNDOS_FIXOS.includes(mundo as any)) {
        if (p.produtoSku) skusPorMundo[mundo].add(p.produtoSku);
      }
    });

    return { caixasPorFabrica, skusPorMundo };
  }, [todosPedidos, isVinculado]);

  // Conteúdo dos cards de automação
  const renderCardContent = (
    temRegistros: boolean,
    count: number,
    porConsultor: Record<string, number>,
    cor: "red" | "blue"
  ) => {
    if (automacao.isPending) {
      return (
        <p className={`text-sm font-bold text-slate-400 uppercase flex items-center gap-2 mt-4`}>
          <RefreshCw className={`animate-spin ${cor === "red" ? "text-red-500" : "text-blue-500"}`} size={16} />
          Lendo estoque...
        </p>
      );
    }

    if (!temRegistros) {
      return (
        <div className="flex flex-col items-center gap-2 mt-4">
          <PackageOpen size={28} className="text-slate-300" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center">
            Nenhum registro encontrado.
          </p>
        </div>
      );
    }

    if (count === 0) {
      return (
        <div className="flex flex-col items-center gap-1 mt-4">
          <CheckCircle2 size={28} className="text-green-400" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
            Nenhuma atualização hoje
          </p>
        </div>
      );
    }

    return <ListaConsultores porConsultor={porConsultor} cor={cor} />;
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Olá, {userName?.split(" ")[0]}! 👋
        </h1>
        <p className="text-slate-500 font-medium">Aqui está a visão geral do trânsito de mercadorias no momento.</p>
      </div>

      {(!urlPlanilha || !urlDemandas) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={20} />
            <p className="text-sm font-bold">
              {!urlPlanilha && !urlDemandas
                ? "As fontes de dados do painel não foram configuradas."
                : !urlPlanilha
                  ? "A fonte de dados de Recebimento Futuro não foi configurada."
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

      {/* BLOCO 1: CAIXAS POR FÁBRICA */}
      <div className="space-y-3">
        <div className="bg-blue-700 text-white p-3 rounded-t-xl flex items-center justify-center gap-2 shadow-md">
          <Box size={20} />
          <h2 className="font-black tracking-widest uppercase text-sm">Caixas - Por Fábrica</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {FABRICAS_FIXAS.map(fabrica => (
            <Card key={fabrica} className="p-0 overflow-hidden border-2 border-slate-200 shadow-sm flex flex-col">
              <div className="bg-blue-600 text-white text-center py-2 text-[11px] font-black uppercase tracking-widest">
                {fabrica}
              </div>
              <div className="flex-1 bg-blue-50 flex items-center justify-center py-6">
                <span className="text-5xl font-black text-slate-800">
                  {kpis.caixasPorFabrica[fabrica] === 0 || !isVinculado ? "-" : kpis.caixasPorFabrica[fabrica]}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* BLOCO 2: VARIEDADE POR MUNDO */}
      <div className="space-y-3">
        <div className="bg-blue-700 text-white p-3 rounded-t-xl flex items-center justify-center gap-2 shadow-md">
          <Globe size={20} />
          <h2 className="font-black tracking-widest uppercase text-sm">Variedade de Produtos - Por Mundo</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {MUNDOS_FIXOS.map(mundo => (
            <Card key={mundo} className="p-0 overflow-hidden border-2 border-slate-200 shadow-sm flex flex-col">
              <div
                className="text-center py-2 text-[11px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-900"
                style={{ backgroundColor: MUNDO_COLORS[mundo] || '#eee' }}
              >
                {mundo}
              </div>
              <div className="flex-1 bg-slate-900 flex items-center justify-center py-6">
                <span className="text-5xl font-black text-white">
                  {kpis.skusPorMundo[mundo]?.size === 0 || !isVinculado ? "-" : kpis.skusPorMundo[mundo]?.size}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* BLOCO 3: ALERTAS E DEMANDAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">

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