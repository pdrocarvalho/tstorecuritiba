/**
 * client/src/pages/home/PainelOperacoes.tsx
 */
import { useState, useMemo, useEffect } from "react";
import { Box, Globe, AlertTriangle, TrendingUp, RefreshCw, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const MUNDO_COLORS: Record<string, string> = {
  "CORTAR": "#fca5a5",   
  "EQUIPAR": "#93c5fd",  
  "FESTEJAR": "#c4b5fd", 
  "PREPARAR": "#86efac", 
  "SERVIR": "#fde047"    
};

const FABRICAS_FIXAS = ["CUTELARIA", "FARROUPILHA", "CD SUL", "TEEC", "BELÉM", "DELTA"];
const MUNDOS_FIXOS = ["CORTAR", "EQUIPAR", "FESTEJAR", "PREPARAR", "SERVIR"];

interface PainelOperacoesProps {
  userName?: string;
}

export default function PainelOperacoes({ userName }: PainelOperacoesProps) {
  // 🚀 LÊ TUDO DO COFRE CENTRAL
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const [urlDemandas] = useState(() => localStorage.getItem("url_demandas") || "");
  
  const isVinculado = !!urlPlanilha;

  // 1. Busca os dados de recebimento (Gráficos principais)
  const { data: todosPedidos = [] } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado, refetchInterval: 60000 } 
  );

  // 2. O GATILHO DO ROBÔ AUTOMÁTICO
  const [resultadoAutomacao, setResultadoAutomacao] = useState<{ 
    alertas: number, 
    alertasMsg: string,
    vendas: number,
    vendasMsg: string 
  } | null>(null);
  
  const automacao = trpc.notifications.rodarAutomacaoDemandas.useMutation({
    onSuccess: (data) => {
      setResultadoAutomacao({ 
        alertas: data.alertasNotificados, 
        alertasMsg: data.alertasMensagem || "",
        vendas: data.vendasNotificadas,
        vendasMsg: data.vendasMensagem || ""
      });
    }
  });

  // Assim que a tela carrega, manda o robô cruzar os dados!
  useEffect(() => {
    if (urlPlanilha && urlDemandas) {
      automacao.mutate({ urlRecebimento: urlPlanilha, urlDemandas: urlDemandas });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPlanilha, urlDemandas]);


  // 3. Cálculos dos KPIs Superiores
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
      if (MUNDOS_FIXOS.includes(mundo)) {
        if (p.produtoSku) skusPorMundo[mundo].add(p.produtoSku);
      }
    });

    return { caixasPorFabrica, skusPorMundo };
  }, [todosPedidos, isVinculado]);


  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Olá, {userName?.split(" ")[0]}! 👋
        </h1>
        <p className="text-slate-500 font-medium">Aqui está a visão geral do trânsito de mercadorias no momento.</p>
      </div>

      {/* 🚀 AVISO INTELIGENTE: Pede para ir para as Configurações */}
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
        
        {/* Card Alertas */}
        <Card className="p-0 overflow-hidden border-2 border-red-200 shadow-sm flex flex-col">
          <div className="bg-red-100 text-red-700 text-center py-3 text-xs font-black uppercase tracking-widest border-b border-red-200 flex items-center justify-center gap-2">
            <AlertTriangle size={16} /> Alerta de Demanda
          </div>
          <div className="p-6 text-center bg-white flex-1 flex flex-col justify-center items-center gap-2">
            {!urlDemandas ? (
              <p className="text-sm font-bold text-slate-400 uppercase">Planilha não vinculada</p>
            ) : automacao.isPending ? (
              <p className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><RefreshCw className="animate-spin text-red-500" size={16}/> Lendo estoque...</p>
            ) : resultadoAutomacao ? (
              <>
                <span className="text-4xl font-black text-red-600">{resultadoAutomacao.alertas}</span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 text-center">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0"/> 
                  {resultadoAutomacao.alertasMsg || "Sem notificações hoje"}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-slate-400 uppercase">Aguardando dados...</p>
            )}
          </div>
        </Card>

        {/* Card Vendas Futuras */}
        <Card className="p-0 overflow-hidden border-2 border-blue-200 shadow-sm flex flex-col">
          <div className="bg-blue-100 text-blue-700 text-center py-3 text-xs font-black uppercase tracking-widest border-b border-blue-200 flex items-center justify-center gap-2">
            <TrendingUp size={16} /> Venda Futura
          </div>
          <div className="p-6 text-center bg-white flex-1 flex flex-col justify-center items-center gap-2">
            {!urlDemandas ? (
              <p className="text-sm font-bold text-slate-400 uppercase">Planilha não vinculada</p>
            ) : automacao.isPending ? (
              <p className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><RefreshCw className="animate-spin text-blue-500" size={16}/> Lendo estoque...</p>
            ) : resultadoAutomacao ? (
              <>
                <span className="text-4xl font-black text-blue-600">{resultadoAutomacao.vendas}</span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 text-center">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0"/> 
                  {resultadoAutomacao.vendasMsg || "Sem notificações hoje"}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-slate-400 uppercase">Aguardando dados...</p>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}