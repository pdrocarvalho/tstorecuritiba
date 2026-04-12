/**
 * client/src/pages/recebimento/Dashboard.tsx
 */
import { useMemo } from "react";
import { Package, Truck, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import type { Pedido } from "@/types";

const CORES_MUNDO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function RecebimentoDashboard() {
  const { data: todosPedidos = [], isLoading } = trpc.notifications.getPending.useQuery();

  const kpis = useMemo(() => {
    const futuros = (todosPedidos as Pedido[]).filter((p) => !p.dataEntrega);
    let totalUnidades = 0;
    const notasSet = new Set<string>();
    let atrasados = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const contagemMundo: Record<string, number> = {};
    const contagemRemetente: Record<string, number> = {};

    futuros.forEach((p) => {
      const unidadesReais = p.quantidade * (p.qtdePorCaixa || 1);
      totalUnidades += unidadesReais;
      if (p.notaFiscal) notasSet.add(p.notaFiscal);

      if (p.previsaoEntrega) {
        const previsao = new Date(p.previsaoEntrega);
        if (previsao < hoje) atrasados++;
      }

      const mundo = p.mundo || "Sem Mundo";
      contagemMundo[mundo] = (contagemMundo[mundo] || 0) + unidadesReais;

      const remetente = p.remetente || "Desconhecido";
      contagemRemetente[remetente] = (contagemRemetente[remetente] || 0) + unidadesReais;
    });

    return {
      totalUnidades,
      notasEmTransito: notasSet.size,
      atrasados,
      grafMundo: Object.entries(contagemMundo).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(contagemRemetente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos]);

  if (isLoading) return <MainLayout><div className="p-8 text-center">Carregando painel...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-gray-600 mt-1">Indicadores estratégicos do Recebimento Futuro</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total a Receber</p>
              <h3 className="text-3xl font-extrabold text-gray-900">{kpis.totalUnidades}</h3>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Package size={28} /></div>
          </Card>

          <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Notas em Trânsito</p>
              <h3 className="text-3xl font-extrabold text-gray-900">{kpis.notasEmTransito}</h3>
            </div>
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><Truck size={28} /></div>
          </Card>

          <Card className={`p-6 border-l-4 shadow-sm flex items-center justify-between ${kpis.atrasados > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Atrasos</p>
              <h3 className={`text-3xl font-extrabold ${kpis.atrasados > 0 ? 'text-red-600' : 'text-gray-900'}`}>{kpis.atrasados}</h3>
            </div>
            <div className={`p-3 rounded-full ${kpis.atrasados > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}><AlertTriangle size={28} /></div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-6">Volume por Mundo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={kpis.grafMundo} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {kpis.grafMundo.map((_, index) => <Cell key={index} fill={CORES_MUNDO[index % CORES_MUNDO.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-6">Volume por Fábrica</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.grafRemetente} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                  <Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}