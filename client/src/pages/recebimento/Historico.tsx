/**
 * client/src/pages/recebimento/Historico.tsx
 *
 * Painel Analítico do Histórico de Entregas
 * Exibe KPIs e gráficos de tudo o que JÁ CHEGOU, com filtros de data.
 */

import { useState, useMemo } from "react";
import { Filter, X, Box, FileText, Layers, Calendar, PackageOpen } from "lucide-react";
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

const INITIAL_FILTERS: FiltrosHistorico = {
  dataInicio: "",
  dataFim: "",
  remetente: "",
  mundo: "",
};

export default function RecebimentoHistorico() {
  const [filtros, setFiltros] = useState<FiltrosHistorico>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(true);

  // Busca os dados do banco
  const { data: todosPedidos = [], isLoading } = trpc.notifications.getPending.useQuery();

  // 🧠 LÓGICA DE NEGÓCIO E CÁLCULO DOS KPIS
  const kpis = useMemo(() => {
    let totalVolumes = 0;
    let totalUnidades = 0;
    const notasSet = new Set<string>();
    
    // Para agrupar Referências Únicas por Mundo
    const skusPorMundo: Record<string, Set<string>> = {};
    
    // Para ver quem mais enviou caixas
    const volumesPorRemetente: Record<string, number> = {};

    // 1. FILTRAGEM
    const historicoFiltrado = (todosPedidos as Pedido[]).filter((p) => {
      if (!p.dataEntrega) return false; // Regra de Ouro: Só entra o que já chegou

      // Filtro de Texto
      if (filtros.remetente && !p.remetente?.toLowerCase().includes(filtros.remetente.toLowerCase())) return false;
      if (filtros.mundo && !p.mundo?.toLowerCase().includes(filtros.mundo.toLowerCase())) return false;

      // Filtro de Datas
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

    // 2. CÁLCULO
    historicoFiltrado.forEach((p) => {
      // Quantidades
      totalVolumes += p.quantidade; // Caixas físicas
      totalUnidades += p.quantidade * (p.qtdePorCaixa || 1); // Unidades reais para venda

      // Notas Fiscais únicas
      if (p.notaFiscal) notasSet.add(p.notaFiscal);

      // Referências Únicas por Mundo
      const mundo = p.mundo || "Sem Mundo";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);

      // Volumes por Remetente
      const remetente = p.remetente || "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    // 3. FORMATAÇÃO PARA OS GRÁFICOS
    const grafSkusMundo = Object.keys(skusPorMundo)
      .map(mundo => ({ name: mundo, value: skusPorMundo[mundo].size }))
      .sort((a, b) => b.value - a.value);

    const grafRemetente = Object.entries(volumesPorRemetente)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalVolumes,
      totalUnidades,
      totalNotas: notasSet.size,
      grafSkusMundo,
      grafRemetente
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

        {/* 🎛️ BARRA DE FILTROS */}
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

        {/* 🏆 CARDS DE KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border-t-4 border-t-emerald-500 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-md"><Box size={20} /></div>
              <p className="text-sm font-bold text-gray-500 uppercase">Volumes (Caixas)</p>
            </div>
            <h3 className="text-3xl font-black text-gray-900">{kpis.totalVolumes}</h3>
          </Card>

          <Card className="p-5 border-t-4 border-t-blue-500 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-md"><PackageOpen size={20} /></div>
              <p className="text-sm font-bold text-gray-500 uppercase">Unidades Totais</p>
            </div>
            <h3 className="text-3xl font-black text-gray-900">{kpis.totalUnidades}</h3>
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
            {/* Soma de todos os SKUs únicos encontrados no período */}
            <h3 className="text-3xl font-black text-gray-900">
              {kpis.grafSkusMundo.reduce((acc, curr) => acc + curr.value, 0)}
            </h3>
          </Card>
        </div>

        {/* 📊 GRÁFICOS ANALÍTICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 1: SKUs Únicos por Mundo */}
          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">Referências (SKUs) Únicas por Mundo</h3>
            <p className="text-xs text-gray-500 mb-6">Diversidade do mix de produtos recebido</p>
            <div className="h-64">
              {kpis.grafSkusMundo.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">Sem dados no período</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis.grafSkusMundo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value) => [`${value} SKUs diferentes`, 'Quantidade']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {kpis.grafSkusMundo.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_MUNDO[index % CORES_MUNDO.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Gráfico 2: Volumes por Remetente */}
          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">Volume de Caixas por Remetente</h3>
            <p className="text-xs text-gray-500 mb-6">Fábricas que mais enviaram mercadoria física</p>
            <div className="h-64">
              {kpis.grafRemetente.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">Sem dados no período</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={kpis.grafRemetente} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                      {kpis.grafRemetente.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_MUNDO[(index + 2) % CORES_MUNDO.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} caixas`, 'Volume']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
}