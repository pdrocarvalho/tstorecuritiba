/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo } from "react";
import { 
  Link2, RefreshCw, X, Filter, Box, FileText, 
  Layers, TableProperties 
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
  const [urlPlanilha, setUrlPlanilha] = useState("");
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  // 🚀 MODO RECEBIMENTO ATIVADO PARA O HISTÓRICO
  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: false }
  );

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Insira o link da planilha de Banco de Dados.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (!result.isError) {
        toast.success("Histórico vinculado com sucesso!");
        setIsVinculado(true);
        setUltimaSincronizacao(Date.now());
      } else {
        toast.error("Erro ao ler planilha.");
      }
    } catch (error) {
      toast.error("Erro de conexão.");
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleAtualizar = async () => {
    const agora = Date.now();
    if (ultimaSincronizacao !== 0 && (agora - ultimaSincronizacao) < 30000) {
      const resto = Math.ceil((30000 - (agora - ultimaSincronizacao)) / 1000);
      return toast.warning(`Aguarde ${resto}s para atualizar.`);
    }
    setIsSincronizando(true);
    await refetch();
    setUltimaSincronizacao(Date.now());
    toast.success("Dados do histórico atualizados!");
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Entregas</h1>
          <p className="text-gray-600 mt-1">Análise de produtividade e mercadorias recebidas</p>
        </div>

        <Card className="p-4 border-emerald-100 bg-emerald-50/50 flex gap-4 items-center">
          <Input 
            placeholder="Link da planilha de Banco de Dados..." 
            value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} 
            disabled={isVinculado} className="flex-1 bg-white" 
          />
          {!isVinculado ? (
            <button onClick={handleVincular} disabled={isSincronizando} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold">Vincular</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleAtualizar} disabled={isSincronizando} className="bg-blue-600 text-white px-6 py-2.5 rounded-md font-medium flex items-center gap-2">
                <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
              </button>
              <button onClick={() => { setIsVinculado(false); setUrlPlanilha(""); }} className="text-slate-400 hover:text-red-600"><X size={24}/></button>
            </div>
          )}
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="p-4 bg-white shadow-sm">
              <div className="flex items-center gap-2 text-slate-700 font-bold mb-4">
                <Filter size={18} /> Filtros de Período e Origem
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} />
                <Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} />
                <Input placeholder="Fábrica..." value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} />
                <Input placeholder="Mundo..." value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} />
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-t-4 border-t-emerald-500">
                <p className="text-xs font-bold text-gray-500 uppercase">Volumes Entregues</p>
                <h3 className="text-3xl font-black">{kpis.totalVolumes}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-purple-500">
                <p className="text-xs font-bold text-gray-500 uppercase">NFs Conferidas</p>
                <h3 className="text-3xl font-black">{kpis.totalNotas}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-orange-500">
                <p className="text-xs font-bold text-gray-500 uppercase">SKUs Distintos</p>
                <h3 className="text-3xl font-black">{kpis.grafSkusMundo.reduce((acc, curr) => acc + curr.value, 0)}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-bold mb-4">Recebimentos por Mundo</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={kpis.grafSkusMundo}>
                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {kpis.grafSkusMundo.map((_, i) => <Cell key={i} fill={CORES_MUNDO[i % CORES_MUNDO.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-4">Distribuição por Fábrica</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={kpis.grafRemetente} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                      {kpis.grafRemetente.map((_, i) => <Cell key={i} fill={CORES_MUNDO[(i + 2) % CORES_MUNDO.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}