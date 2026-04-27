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
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const [urlDemandas] = useState(() => localStorage.getItem("url_demandas") || "");
  
  const isVinculado = !!urlPlanilha;

  const { data: todosPedidos = [] } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado, refetchInterval: 60000 } 
  );

  // 🚀 ATUALIZADO: Estado agora suporta as mensagens personalizadas
  const [resultadoAutomacao, setResultadoAutomacao] = useState<{ 
    alertas: number, 
    alertasMsg: string,
    vendas: number,
    vendasMsg: string 
  } | null>(null);
  
  const automacao = trpc.notifications.rodarAutomacaoDemandas.useMutation({
    onSuccess: (data) => {
      // 🚀 CAPTURA AS MENSAGENS VINDAS DO BACK-END
      setResultadoAutomacao({ 
        alertas: data.alertasNotificados, 
        alertasMsg: data.alertasMensagem || "",
        vendas: data.vendasNotificadas,
        vendasMsg: data.vendasMensagem || ""
      });
    }
  });

  useEffect(() => {
    if (urlPlanilha && urlDemandas) {
      automacao.mutate({ urlRecebimento: urlPlanilha, urlDemandas: urlDemandas });
    }
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
      if (fabricaMatch) caixasPorFabrica[fabricaMatch] += qtdeCaixas;
      else caixasPorFabrica["DELTA"] = (caixasPorFabrica["DELTA"] || 0) + qtdeCaixas;
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

      {(!urlPlanilha || !urlDemandas) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={20} />
            <p className="text-sm font-bold">As fontes de dados do painel não foram configuradas.</p>
          </div>
          <Link href="/configuracoes">
            <button className="bg-amber-600 text-white hover:bg-amber-700 px-6 py-2 rounded-lg font-bold transition-colors">
              Ir para Configurações
            </button>
          </Link>
        </div>
      )}

      {/* KPI CARDS (FABRICA/MUNDO) - Mantidos sem alteração */}
      {/* ... (código dos blocos 1 e 2 omitidos aqui para brevidade, mas devem permanecer iguais) ... */}

      {/* BLOCO 3: ALERTAS E DEMANDAS - ATUALIZADO 🚀 */}
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
                {/* 🚀 TROCAMOS O TEXTO FIXO PELA MENSAGEM DO BACK-END */}
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
                {/* 🚀 TROCAMOS O TEXTO FIXO PELA MENSAGEM DO BACK-END */}
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