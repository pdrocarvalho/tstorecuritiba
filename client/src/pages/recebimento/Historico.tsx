/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo, useEffect } from "react";
import { 
  Link2, RefreshCw, X, Filter, ChevronDown, ChevronUp 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis
} from "recharts";
import { toast } from "sonner"; 
import type { Pedido } from "@/types";

// 🎨 PALETA DE CORES VIBRANTES (PADRONIZADA)
const MUNDO_COLORS: Record<string, string> = {
  "CORTAR": "#e57373",
  "FESTEJAR": "#9575cd",
  "PREPARAR": "#81c784",
  "SERVIR": "#fbc02d",
  "EQUIPAR": "#42a5f5"
};
const COR_PADRAO = "#94a3b8";

interface FiltrosHistorico {
  dataInicio: string;
  dataFim: string;
  remetente: string;
  mundo: string;
}

const INITIAL_FILTERS: FiltrosHistorico = {
  dataInicio: "",
  dataFim: "",
  remetente: "",
  mundo: ""
};

export default function RecebimentoHistorico() {
  const [urlPlanilha, setUrlPlanilha] = useState(() => sessionStorage.getItem("url_historico") || "");
  const [isVinculado, setIsVinculado] = useState(() => sessionStorage.getItem("vinculado_historico") === "true");
  
  const [showFilters, setShowFilters] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);

  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado && !!urlPlanilha }
  );

  useEffect(() => {
    if (isVinculado && urlPlanilha) refetch();
  }, []);

  const kpis = useMemo(() => {
    const filtrados = (todosPedidos as Pedido[]).filter((p) => {
      if (!p.dataEntrega) return false;

      const dataEnt = new Date(p.dataEntrega);
      dataEnt.setHours(0,0,0,0);

      if (filtros.dataInicio) {
        const inicio = new Date(filtros.dataInicio + "T00:00:00");
        if (dataEnt < inicio) return false;
      }
      if (filtros.dataFim) {
        const fim = new Date(filtros.dataFim + "T23:59:59");
        if (dataEnt > fim) return false;
      }

      if (filtros.remetente && !p.remetente?.toLowerCase().includes(filtros.remetente.toLowerCase())) return false;
      if (filtros.mundo && !p.mundo?.toLowerCase().includes(filtros.mundo.toLowerCase())) return false;

      return true;
    });

    let totalVolumes = 0;
    const notasSet = new Set<string>();
    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    filtrados.forEach((p) => {
      totalVolumes += p.quantidade;
      if (p.notaFiscal) notasSet.add(p.notaFiscal.trim());
      
      const mundo = p.mundo?.trim().toUpperCase() || "SEM MUNDO";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);

      const rem = p.remetente || "Desconhecido";
      volumesPorRemetente[rem] = (volumesPorRemetente[rem] || 0) + p.quantidade;
    });

    return {
      totalVolumes, 
      totalNotas: notasSet.size,
      diversidadeSkus: Object.keys(skusPorMundo).length,
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })),
      grafRemetente: Object.entries(volumesPorRemetente)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) // Top 10 remetentes para não poluir
    };
  }, [todosPedidos, filtros]);

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Insira o link.");
    try {
      const result = await refetch();
      if (!result.isError) {
        setIsVinculado(true);
        sessionStorage.setItem("url_historico", urlPlanilha);
        sessionStorage.setItem("vinculado_historico", "true");
        toast.success("Histórico vinculado!");
      }
    } catch (e) { toast.error("Erro ao vincular."); }
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Histórico de Entregas</h1>

        <Card className="p-4 border-emerald-100 bg-emerald-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Banco de Dados Histórico</span>
            <Input value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white border-emerald-200" />
          </div>
          <div className="flex gap-2 pt-5">
            {!isVinculado ? (
              <button onClick={handleVincular} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md">
                <Link2 size={18} /> Vincular
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => refetch()} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">
                  <RefreshCw size={18} /> Atualizar
                </button>
                <button onClick={() => {setIsVinculado(false); sessionStorage.clear();}} className="p-2.5 text-slate-400 bg-white rounded-lg border border-slate-200"><X size={20} /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* SEÇÃO DE FILTROS */}
            <Card className="p-4 border-slate-200 bg-white shadow-sm">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-between w-full text-slate-700 font-bold hover:text-blue-600">
                <div className="flex items-center gap-2"><Filter size={18} /> Filtros de Pesquisa</div>
                {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showFilters && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase">Início</label><Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} className="mt-1" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label><Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} className="mt-1" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase">Remetente</label><Input placeholder="Filtrar fábrica..." value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} className="mt-1" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase">Mundo</label><Input placeholder="Filtrar mundo..." value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} className="mt-1" /></div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Volumes Recebidos</p>
                <h3 className="text-3xl font-black">{kpis.totalVolumes}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-purple-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas Processadas</p>
                <h3 className="text-3xl font-black">{kpis.totalNotas}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-orange-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diversidade de SKUs</p>
                <h3 className="text-3xl font-black">{kpis.diversidadeSkus}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PIZZA: SKUs POR MUNDO */}
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest text-center">SKUs por Mundo</h3>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={kpis.grafSkusMundo} cx="50%" cy="42%" innerRadius={70} outerRadius={100} dataKey="value">
                        {kpis.grafSkusMundo.map((entry, i) => (
                          <Cell key={i} fill={MUNDO_COLORS[entry.name.toUpperCase()] || COR_PADRAO} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* BARRA: VOLUMES POR REMETENTE (RESTAURADO 🚀) */}
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest text-center">Volumes por Remetente</h3>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={kpis.grafRemetente} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}