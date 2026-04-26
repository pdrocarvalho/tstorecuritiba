/**
 * client/src/pages/home/PainelOperacoes.tsx
 */
import { useState, useMemo } from "react";
import { Box, Globe, AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
  const [urlPlanilha] = useState(() => sessionStorage.getItem("url_recebimento") || "");
  const isVinculado = !!urlPlanilha;

  const { data: todosPedidos = [] } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado, refetchInterval: 60000 } 
  );

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

      {!isVinculado && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={20} />
            <p className="text-sm font-bold">O painel está zerado pois a fonte de dados do Recebimento Futuro não foi vinculada.</p>
          </div>
          <Link href="/recebimento-futuro">
            <Button className="bg-amber-600 text-white hover:bg-amber-700 font-bold">
              Vincular Planilha
            </Button>
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
          <div className="p-8 text-center bg-white flex-1 flex flex-col justify-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Aguardando Lógica...</p>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden border-2 border-blue-200 shadow-sm flex flex-col">
          <div className="bg-blue-100 text-blue-700 text-center py-3 text-xs font-black uppercase tracking-widest border-b border-blue-200 flex items-center justify-center gap-2">
            <TrendingUp size={16} /> Venda Futura
          </div>
          <div className="p-8 text-center bg-white flex-1 flex flex-col justify-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Aguardando Lógica...</p>
          </div>
        </Card>
      </div>

    </div>
  );
}