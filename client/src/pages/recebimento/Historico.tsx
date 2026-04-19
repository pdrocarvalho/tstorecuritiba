/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo, useEffect } from "react";
import { 
  Link2, RefreshCw, X, Filter, Box, FileText, 
  Layers, TableProperties, ChevronDown, ChevronUp 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from "recharts";
import { toast } from "sonner"; 
import type { Pedido } from "@/types";

const CORES_MUNDO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface FiltrosHistorico { dataInicio: string; dataFim: string; remetente: string; mundo: string; }
const INITIAL_FILTERS: FiltrosHistorico = { dataInicio: "", dataFim: "", remetente: "", mundo: "" };

export default function RecebimentoHistorico() {
  // 🚀 PERSISTÊNCIA: Inicializa estados buscando no sessionStorage
  const [urlPlanilha, setUrlPlanilha] = useState(() => {
    return sessionStorage.getItem("url_historico") || "";
  });

  const [isVinculado, setIsVinculado] = useState(() => {
    return sessionStorage.getItem("vinculado_historico") === "true";
  });

  const [isSincronizando, setIsSincronizando] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado && !!urlPlanilha }
  );

  // 🚀 AUTO-LOAD: Garante que os dados apareçam ao retornar à aba
  useEffect(() => {
    if (isVinculado && urlPlanilha) {
      refetch();
    }
  }, []);

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Insira o link da planilha.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (!result.isError) {
        setIsVinculado(true);
        // 🚀 SALVA NO sessionStorage
        sessionStorage.setItem("url_historico", urlPlanilha);
        sessionStorage.setItem("vinculado_historico", "true");
        toast.success("Histórico vinculado!");
        setUltimaSincronizacao(Date.now());
      }
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    // 🚀 LIMPA O sessionStorage
    sessionStorage.removeItem("url_historico");
    sessionStorage.removeItem("vinculado_historico");
    setFiltros(INITIAL_FILTERS);
    toast.info("Vínculo removido.");
  };

  const handleAtualizar = async () => {
    const agora = Date.now();
    if (ultimaSincronizacao !== 0 && (agora - ultimaSincronizacao) < 30000) {
      return toast.warning("Aguarde 30s.");
    }
    setIsSincronizando(true);
    await refetch();
    setUltimaSincronizacao(Date.now());
    toast.success("Histórico atualizado!");
    setIsSincronizando(false);
  };

  const kpis = useMemo(() => {
    let totalVolumes = 0;
    const notasSet = new Set<string>();
    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    const historicoFiltrado = (todosPedidos as Pedido[]).filter((p) => {
      if (!p.dataEntrega) return false;
      if (filtros.remetente && !p.remetente?.toLowerCase().includes(filtros.remetente.toLowerCase())) return false;
      if (filtros.mundo && !p.mundo?.toLowerCase().includes(filtros.mundo.toLowerCase())) return false;

      const dataEntrega = new Date(p.dataEntrega);
      dataEntrega.setHours(0, 0, 0, 0);

      if (filtros.dataInicio) {
        const inicio = new Date(filtros.dataInicio + "T00:00:00");
        if (dataEntrega < inicio) return false;
      }
      if (filtros.dataFim) {
        const fim = new Date(filtros.dataFim + "T23:59:59");
        if (dataEntrega > fim) return false;
      }
      return true;
    });

    historicoFiltrado.forEach((p) => {
      totalVolumes += p.quantidade;
      if (p.notaFiscal) notasSet.add(p.notaFiscal.trim());
      const mundo = p.mundo?.trim() || "Sem Mundo";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);
      const remetente = p.remetente?.trim() || "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    return {
      totalVolumes, 
      totalNotas: notasSet.size,
      grafSkusMundo: Object.keys(skusPorMundo).map(m => ({ name: m, value: skusPorMundo[m].size })).sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(volumesPorRemetente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos, filtros]);

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Histórico de Entregas</h1>
          <p className="text-gray-600 mt-1">Análise de produtividade e recebimentos concluídos</p>
        </div>

        <Card className="p-4 border-emerald-100 bg-emerald-50/50 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Fonte de Dados</span>
            <Input 
              placeholder="Link da planilha de Banco de Dados..." 
              value={urlPlanilha} 
              onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado} className="bg-white border-emerald-200 rounded-lg" 
            />
          </div>
          
          <div className="flex gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold min-w-[160px] shadow-md transition-all">
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />}
                {isSincronizando ? "Lendo..." : "Vincular Banco"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleAtualizar} disabled={isSincronizando} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm">
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
                </button>
                <button onClick={handleCancelar} className="p-2.5 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm">
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="p-4 border-slate-200 bg-white shadow-sm">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-between w-full text-slate-700 font-bold">
                <div className="flex items-center gap-2"><Filter size={18} /> Filtros de Análise</div>
                {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showFilters && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} />
                  <Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} />
                  <Input placeholder="Fábrica..." value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} />
                  <Input placeholder="Mundo..." value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} />
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase">Volumes Entregues</p>
                <h3 className="text-3xl font-black">{kpis.totalVolumes}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-purple-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase">NFs Conferidas</p>
                <h3 className="text-3xl font-black">{kpis.totalNotas}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-orange-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase">SKUs Processados</p>
                <h3 className="text-3xl font-black">{kpis.grafSkusMundo.reduce((acc, curr) => acc + curr.value, 0)}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm"><h3 className="font-bold mb-4">SKUs por Mundo</h3><ResponsiveContainer width="100%" height={300}><BarChart data={kpis.grafSkusMundo}><XAxis dataKey="name" tick={{fontSize: 10}} /><YAxis /><Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{kpis.grafSkusMundo.map((_, i) => <Cell key={i} fill={CORES_MUNDO[i % CORES_MUNDO.length]} />)}</Bar></BarChart></ResponsiveContainer></Card>
              <Card className="p-6 shadow-sm"><h3 className="font-bold mb-4">Distribuição por Fábrica</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={kpis.grafRemetente} innerRadius={60} outerRadius={90} dataKey="value">{kpis.grafRemetente.map((_, i) => <Cell key={i} fill={CORES_MUNDO[(i + 2) % CORES_MUNDO.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></Card>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}