/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo } from "react";
import { Filter, X, Box, FileText, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import type { Pedido } from "@/types";

const CORES_MUNDO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface FiltrosHistorico {
  dataInicio: string;
  dataFim: string;
  remetente: string;
  mundo: string;
}

const INITIAL_FILTERS: FiltrosHistorico = { dataInicio: "", dataFim: "", remetente: "", mundo: "" };

export default function RecebimentoHistorico() {
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(true);

  const { data: todosPedidos = [], isLoading } = trpc.notifications.getPending.useQuery();

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

      if (p.notaFiscal && p.notaFiscal.trim() !== "") {
        notasSet.add(p.notaFiscal.trim());
      }

      const mundo = p.mundo?.trim() ? p.mundo.trim() : "Sem Mundo";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);

      const remetente = p.remetente?.trim() ? p.remetente.trim() : "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    return {
      totalVolumes,
      totalNotas: notasSet.size,
      grafSkusMundo: Object.keys(skusPorMundo).map(mundo => ({ name: mundo, value: skusPorMundo[mundo].size })).sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(volumesPorRemetente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos, filtros]);

  if (isLoading) return <MainLayout><div className="flex h-full items-center justify-center">Carregando histórico...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Entregas</h1>
          <p className="text-gray-600 mt-1">Análise de produtividade e recebimentos concluídos</p>
        </div>

        <Card className="p-4 border-emerald-100 bg-emerald-50/30">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-emerald-700 font-bold hover:text-emerald-800">
            <Filter size={18} /> Filtros de Análise {showFilters ? <X size={16} /> : null}
          </button>
          
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="block">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Data Inicial</span>
                <Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} className="bg-white" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Data Final</span>
                <Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} className="bg-white" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Remetente (Fábrica)</span>
                <Input placeholder="Ex: Cutelaria" value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} className="bg-white" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Mundo</span>
                <Input placeholder="Ex: Servir" value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} className="bg-white" />
              </label>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border-t-4 border-t-emerald-500 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Box size={20} /></div>
              <p className="text-sm font-bold text-gray-500 uppercase">Volumes (Caixas)</p>
            </div>
            <h3 className="text-3xl font-black text-gray-900">{kpis.totalVolumes}</h3>
          </Card>

          <Card className="p-5 border-t-4 border-t-purple-500 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-md"><FileText size={20} /></div>
              <p className="text-sm font-bold text-gray-500 uppercase">NFs Conferidas</p>
            </div>
            <h3 className="text-3xl font-black text-gray-900">{kpis.totalNotas}</h3>
          </Card>

          <Card className="p-5 border-t-4 border-t-orange-500 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-md"><Layers size={20} /></div>
              <p className="text-sm font-bold text-gray-500 uppercase">SKUs Únicos</p>
            </div>
            <h3 className="text-3xl font-black text-gray-900">
              {kpis.grafSkusMundo.reduce((acc, curr) => acc + curr.value, 0)}
            </h3>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">Referências (SKUs) Únicas por Mundo</h3>
            <p className="text-xs text-gray-500 mb-6">Diversidade do mix de produtos recebido</p>
            <div className="h-64">
              {/* CORREÇÃO DO ERRO AQUI: minHeight={250} */}
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <BarChart data={kpis.grafSkusMundo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value) => [`${value} SKUs diferentes`, 'Quantidade']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {kpis.grafSkusMundo.map((_, index) => <Cell key={`cell-${index}`} fill={CORES_MUNDO[index % CORES_MUNDO.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">Volume de Caixas por Remetente</h3>
            <p className="text-xs text-gray-500 mb-6">Fábricas que mais enviaram mercadoria física</p>
            <div className="h-64">
               {/* CORREÇÃO DO ERRO AQUI: minHeight={250} */}
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <PieChart>
                  <Pie data={kpis.grafRemetente} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {kpis.grafRemetente.map((_, index) => <Cell key={`cell-${index}`} fill={CORES_MUNDO[(index + 2) % CORES_MUNDO.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} caixas`, 'Volume']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}