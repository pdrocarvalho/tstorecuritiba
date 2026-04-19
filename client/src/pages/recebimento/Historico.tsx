/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo, useEffect } from "react";
import { 
  Link2, RefreshCw, X, Filter, Box, FileText, 
  Layers, ChevronDown, ChevronUp 
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

const MUNDO_COLORS: Record<string, string> = {
  "CORTAR": "#f4cccc",
  "FESTEJAR": "#8e7cc3",
  "PREPARAR": "#d9ead3",
  "SERVIR": "#fff2cc",
  "EQUIPAR": "#6fa8dc"
};
const COR_PADRAO = "#e2e8f0";

export default function RecebimentoHistorico() {
  const [urlPlanilha, setUrlPlanilha] = useState(() => sessionStorage.getItem("url_historico") || "");
  const [isVinculado, setIsVinculado] = useState(() => sessionStorage.getItem("vinculado_historico") === "true");
  const [filtros, setFiltros] = useState({ dataInicio: "", dataFim: "", remetente: "", mundo: "" });

  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado && !!urlPlanilha }
  );

  useEffect(() => {
    if (isVinculado && urlPlanilha) refetch();
  }, []);

  const kpis = useMemo(() => {
    let totalVolumes = 0;
    const notasSet = new Set<string>();
    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    (todosPedidos as Pedido[]).forEach((p) => {
      if (!p.dataEntrega) return;
      const mundo = p.mundo?.trim().toUpperCase() || "SEM MUNDO";
      totalVolumes += p.quantidade;
      if (p.notaFiscal) notasSet.add(p.notaFiscal.trim());
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);
      const remetente = p.remetente?.trim() || "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    return {
      totalVolumes, 
      totalNotas: notasSet.size,
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })),
      grafRemetente: Object.entries(volumesPorRemetente).map(([name, value]) => ({ name, value }))
    };
  }, [todosPedidos]);

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <h1 className="text-3xl font-bold">Histórico de Entregas</h1>

        <Card className="p-4 border-emerald-100 bg-emerald-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Fonte de Dados</span>
            <Input value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white border-emerald-200" />
          </div>
          <div className="flex gap-2 pt-5">
            {!isVinculado ? (
              <button onClick={() => { refetch(); setIsVinculado(true); sessionStorage.setItem("url_historico", urlPlanilha); sessionStorage.setItem("vinculado_historico", "true"); }} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold">Vincular Banco</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => refetch()} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold">Atualizar</button>
                <button onClick={() => { setIsVinculado(false); sessionStorage.removeItem("url_historico"); sessionStorage.removeItem("vinculado_historico"); }} className="p-2.5 text-slate-400 bg-white rounded-lg border border-slate-200"><X size={20} /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in">
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
                <h3 className="text-3xl font-black">{kpis.grafSkusMundo.length}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">SKUs por Mundo (Recebidos)</h3>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={kpis.grafSkusMundo} cx="50%" cy="40%" innerRadius={65} outerRadius={95} dataKey="value">
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

              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">Distribuição por Fábrica (Físico)</h3>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={kpis.grafRemetente} cx="50%" cy="40%" innerRadius={65} outerRadius={95} dataKey="value">
                        {kpis.grafRemetente.map((_, i) => (
                          <Cell key={i} fill={["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][i % 5]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
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