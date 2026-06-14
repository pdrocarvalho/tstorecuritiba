/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo, useEffect } from "react";
import { 
  RefreshCw, Filter, ChevronDown, ChevronUp, AlertTriangle 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis
} from "recharts";
import { Link } from "wouter";

import { MUNDO_COLORS } from "@/constants";
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
  // 🚀 LÊ DO COFRE CENTRAL: O Histórico usa a MESMA base do Recebimento Futuro!
  const [urlPlanilha] = useState(() => localStorage.getItem("url_recebimento") || "");
  const isVinculado = !!urlPlanilha;
  
  const [showFilters, setShowFilters] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);

  const { data: todosPedidos = [], refetch, isFetching } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado }
  );

  useEffect(() => {
    if (isVinculado) refetch();
  }, [isVinculado]);

  const kpis = useMemo(() => {
    const filtrados = (todosPedidos as any[]).filter((p) => {
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
    const todosSkusSet = new Set<string>(); 
    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    filtrados.forEach((p) => {
      const qtdeCaixas = p.volumesCaixas !== undefined ? p.volumesCaixas : (p.quantidade || 0);
      
      totalVolumes += qtdeCaixas;
      
      if (p.notaFiscal) notasSet.add(p.notaFiscal.trim());
      
      if (p.produtoSku) todosSkusSet.add(p.produtoSku.trim());
      
      const mundo = p.mundo?.trim().toUpperCase() || "SEM MUNDO";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);

      const rem = p.remetente || "Desconhecido";
      volumesPorRemetente[rem] = (volumesPorRemetente[rem] || 0) + qtdeCaixas;
    });

    return {
      totalVolumes, 
      totalNotas: notasSet.size,
      diversidadeSkus: todosSkusSet.size, 
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })),
      grafRemetente: Object.entries(volumesPorRemetente)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) 
    };
  }, [todosPedidos, filtros]);

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Histórico de Entregas</h1>
            <p className="text-white/50 mt-1">Métricas e relatórios de mercadorias já recebidas na loja.</p>
          </div>
          {isVinculado && (
            <button onClick={() => refetch()} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg font-bold hover:bg-emerald-500/20 shadow-sm transition-colors">
              <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /> Atualizar
            </button>
          )}
        </div>

        {/* 🚀 AVISO INTELIGENTE SE NÃO ESTIVER VINCULADO */}
        {!isVinculado && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle size={20} />
              <p className="text-sm font-bold">A fonte de dados base do Recebimento não foi configurada.</p>
            </div>
            <Link href="/configuracoes">
              <button className="bg-amber-600 text-white hover:bg-amber-700 px-6 py-2 rounded-lg font-bold transition-colors">
                Ir para Configurações
              </button>
            </Link>
          </div>
        )}

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* SEÇÃO DE FILTROS */}
            <Card className="p-4 bg-glass border-glass-border shadow-sm">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-between w-full text-white/80 font-bold hover:text-brand-secondary transition-colors">
                <div className="flex items-center gap-2"><Filter size={18} /> Filtros de Pesquisa</div>
                {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showFilters && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <div><label className="text-[10px] font-bold text-white/40 uppercase">Início</label><Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} className="mt-1 bg-black/20 border-white/10 text-white" /></div>
                  <div><label className="text-[10px] font-bold text-white/40 uppercase">Fim</label><Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} className="mt-1 bg-black/20 border-white/10 text-white" /></div>
                  <div><label className="text-[10px] font-bold text-white/40 uppercase">Remetente</label><Input placeholder="Filtrar fábrica..." value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} className="mt-1 bg-black/20 border-white/10 text-white placeholder:text-white/30" /></div>
                  <div><label className="text-[10px] font-bold text-white/40 uppercase">Mundo</label><Input placeholder="Filtrar mundo..." value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} className="mt-1 bg-black/20 border-white/10 text-white placeholder:text-white/30" /></div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-t-4 border-t-emerald-500 bg-glass border-glass-border shadow-sm">
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Volumes Recebidos</p>
                <h3 className="text-3xl font-black text-white">{kpis.totalVolumes}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-purple-500 bg-glass border-glass-border shadow-sm">
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Notas Processadas</p>
                <h3 className="text-3xl font-black text-white">{kpis.totalNotas}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-orange-500 bg-glass border-glass-border shadow-sm">
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Diversidade de SKUs</p>
                <h3 className="text-3xl font-black text-white">{kpis.diversidadeSkus}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PIZZA: SKUs POR MUNDO */}
              <Card className="p-6 shadow-sm bg-glass border-glass-border">
                <h3 className="font-bold text-white mb-6 uppercase text-sm tracking-widest text-center">SKUs por Mundo</h3>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={kpis.grafSkusMundo} cx="50%" cy="42%" innerRadius={70} outerRadius={100} dataKey="value">
                        {kpis.grafSkusMundo.map((entry, i) => (
                          <Cell key={i} fill={MUNDO_COLORS[entry.name.toUpperCase()] || COR_PADRAO} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#050A15', borderColor: '#1e293b', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* BARRA: VOLUMES POR REMETENTE */}
              <Card className="p-6 shadow-sm bg-glass border-glass-border">
                <h3 className="font-bold text-white mb-6 uppercase text-sm tracking-widest text-center">Volumes por Remetente</h3>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={kpis.grafRemetente} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fill: '#fff'}} />
                      <Tooltip cursor={{fill: '#ffffff10'}} contentStyle={{ backgroundColor: '#050A15', borderColor: '#1e293b', color: '#fff' }} itemStyle={{ color: '#fff' }} />
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