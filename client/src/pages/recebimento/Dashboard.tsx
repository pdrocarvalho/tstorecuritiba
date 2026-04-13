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

  // 🧠 CÁLCULO CALIBRADO DOS KPIS
  const kpis = useMemo(() => {
    // Apenas produtos SEM data de entrega
    const futuros = (todosPedidos as Pedido[]).filter((p) => !p.dataEntrega);
    
    let totalVolumes = 0;
    const notasSet = new Set<string>();
    const notasAtrasadasSet = new Set<string>(); // Agora conta Notas Fiscais e não produtos

    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    futuros.forEach((p) => {
      // 1. SOMA APENAS OS VOLUMES FÍSICOS (CAIXAS)
      totalVolumes += p.quantidade;
      
      // 2. NOTAS EM TRÂNSITO
      if (p.notaFiscal) notasSet.add(p.notaFiscal);

      // 3. ATRASOS (Agrupa por Nota Fiscal)
      if (p.previsaoEntrega) {
        const previsao = new Date(p.previsaoEntrega);
        // Se está atrasado e tem NF, adiciona a NF ao conjunto de atrasos
        if (previsao < hoje && p.notaFiscal) {
          notasAtrasadasSet.add(p.notaFiscal);
        }
      }

      // 4. REFERÊNCIAS ÚNICAS POR MUNDO
      const mundo = p.mundo || "Sem Mundo";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);

      // 5. VOLUMES (CAIXAS) POR FÁBRICA
      const remetente = p.remetente || "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    return {
      totalVolumes,
      notasEmTransito: notasSet.size,
      atrasados: notasAtrasadasSet.size, // Retorna a quantidade de NFs atrasadas
      grafSkusMundo: Object.entries(skusPorMundo)
        .map(([name, skus]) => ({ name, value: skus.size })) // Pega no tamanho do Set (Qtd de SKUs únicos)
        .sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(volumesPorRemetente)
        .map(([name, value]) => ({ name, value })) // Mantém a soma dos volumes
        .sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos]);

  if (isLoading) return <MainLayout><div className="flex h-full items-center justify-center text-gray-500">A calibrar painel...</div></MainLayout>;

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
              <h3 className="text-3xl font-extrabold text-gray-900">{kpis.totalVolumes}</h3>
              <p className="text-xs text-gray-400 mt-1">volumes / caixas</p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Package size={28} /></div>
          </Card>

          <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Notas em Trânsito</p>
              <h3 className="text-3xl font-extrabold text-gray-900">{kpis.notasEmTransito}</h3>
              <p className="text-xs text-gray-400 mt-1">NFs únicas</p>
            </div>
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><Truck size={28} /></div>
          </Card>

          <Card className={`p-6 border-l-4 shadow-sm flex items-center justify-between ${kpis.atrasados > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Atrasos</p>
              <h3 className={`text-3xl font-extrabold ${kpis.atrasados > 0 ? 'text-red-600' : 'text-gray-900'}`}>{kpis.atrasados}</h3>
              <p className="text-xs text-gray-400 mt-1">notas fiscais atrasadas</p>
            </div>
            <div className={`p-3 rounded-full ${kpis.atrasados > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}><AlertTriangle size={28} /></div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-6">Referências Únicas por Mundo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={kpis.grafSkusMundo} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {kpis.grafSkusMundo.map((_, index) => <Cell key={index} fill={CORES_MUNDO[index % CORES_MUNDO.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} SKUs diferentes`, 'Quantidade']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-6">Volume de Caixas por Fábrica</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.grafRemetente} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value) => [`${value} caixas / volumes`, 'Total']} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}