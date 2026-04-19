/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo } from "react";
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
  const [urlPlanilha, setUrlPlanilha] = useState("");
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  // 🚀 MODO RECEBIMENTO ATIVADO
  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: false }
  );

  // 🚀 CORRIGIDO: Agora com Feedback de Loading e Toast
  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Por favor, insira o link da planilha de Banco de Dados.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error(`Falha no acesso: ${result.error?.message}`);
      } else {
        toast.success("Histórico vinculado com sucesso!");
        setIsVinculado(true);
        setUltimaSincronizacao(Date.now());
      }
    } catch (error) {
      toast.error("Erro inesperado de conexão.");
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleAtualizar = async () => {
    const agora = Date.now();
    if (ultimaSincronizacao !== 0 && (agora - ultimaSincronizacao) < 30000) {
      const resto = Math.ceil((30000 - (agora - ultimaSincronizacao)) / 1000);
      return toast.warning(`Por segurança, aguarde ${resto}s para atualizar.`);
    }
    setIsSincronizando(true);
    await refetch();
    setUltimaSincronizacao(Date.now());
    toast.success("Dados do histórico atualizados!");
    setIsSincronizando(false);
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    setFiltros(INITIAL_FILTERS);
    setUltimaSincronizacao(0);
    toast.info("Histórico desvinculado.");
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

        {/* 🚀 CABEÇALHO DE VINCULAÇÃO PADRONIZADO */}
        <Card className="p-4 border-emerald-100 bg-emerald-50/50 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 block">Fonte de Dados (Banco de Dados)</span>
            <Input 
              placeholder="Cole o link da planilha aqui..." 
              value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado} className="bg-white border-emerald-200 rounded-lg" 
            />
          </div>
          
          <div className="flex gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button 
                onClick={handleVincular} 
                disabled={isSincronizando} 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-2.5 rounded-lg font-bold min-w-[160px] transition-all shadow-md"
              >
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />}
                {isSincronizando ? "Lendo..." : "Vincular Banco"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAtualizar} 
                  disabled={isSincronizando} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> 
                  {isSincronizando ? "Buscando..." : "Atualizar"}
                </button>
                <button 
                  onClick={handleCancelar} 
                  className="p-2.5 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm"
                  title="Desvincular"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </Card>

        {!isVinculado ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <TableProperties size={64} className="mb-4 text-gray-200" />
            <h3 className="text-xl font-medium text-gray-500">Aguardando vinculação de dados</h3>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="p-4 border-slate-200 bg-white shadow-sm">
              <button 
                onClick={() => setShowFilters(!showFilters)} 
                className="flex items-center justify-between w-full text-slate-700 font-bold hover:text-blue-600 transition-colors"
              >
                <div className="flex items-center gap-2"><Filter size={18} /> Filtros de Análise</div>
                {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {showFilters && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <label className="block"><span className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Data Inicial</span><Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} /></label>
                  <label className="block"><span className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Data Final</span><Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} /></label>
                  <label className="block"><span className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Remetente</span><Input placeholder="Filtrar fábrica..." value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} /></label>
                  <label className="block"><span className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Mundo</span><Input placeholder="Filtrar mundo..." value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} /></label>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-t-4 border-t-emerald-500 shadow-sm">
                <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Box size={20} /></div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Volumes Entregues</p></div>
                <h3 className="text-3xl font-black text-gray-900">{kpis.totalVolumes}</h3>
              </Card>

              <Card className="p-5 border-t-4 border-t-purple-500 shadow-sm">
                <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-purple-100 text-purple-600 rounded-md"><FileText size={20} /></div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">NFs Conferidas</p></div>
                <h3 className="text-3xl font-black text-gray-900">{kpis.totalNotas}</h3>
              </Card>

              <Card className="p-5 border-t-4 border-t-orange-500 shadow-sm">
                <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-orange-100 text-orange-600 rounded-md"><Layers size={20} /></div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">SKUs Processados</p></div>
                <h3 className="text-3xl font-black text-gray-900">{kpis.grafSkusMundo.reduce((acc, curr) => acc + curr.value, 0)}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">SKUs por Mundo (Recebidos)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={kpis.grafSkusMundo}>
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <Tooltip cursor={{fill: '#f3f4f6'}} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {kpis.grafSkusMundo.map((_, index) => <Cell key={index} fill={CORES_MUNDO[index % CORES_MUNDO.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">Distribuição por Fábrica (Físico)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={kpis.grafRemetente} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                        {kpis.grafRemetente.map((_, index) => <Cell key={index} fill={CORES_MUNDO[(index + 2) % CORES_MUNDO.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
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