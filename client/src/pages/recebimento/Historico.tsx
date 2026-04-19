/**
 * client/src/pages/recebimento/Historico.tsx
 */

import { useState, useMemo, useEffect } from "react";
import { 
  Link2, RefreshCw, X, Filter, Box, FileText, Layers 
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

// 🎨 NOVA PALETA DE CORES (TONS FORTES)
const MUNDO_COLORS: Record<string, string> = {
  "CORTAR": "#e57373",
  "FESTEJAR": "#9575cd",
  "PREPARAR": "#81c784",
  "SERVIR": "#fbc02d",
  "EQUIPAR": "#42a5f5"
};
const COR_PADRAO = "#94a3b8";

export default function RecebimentoHistorico() {
  const [urlPlanilha, setUrlPlanilha] = useState(() => sessionStorage.getItem("url_historico") || "");
  const [isVinculado, setIsVinculado] = useState(() => sessionStorage.getItem("vinculado_historico") === "true");

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

    (todosPedidos as Pedido[]).forEach((p) => {
      if (!p.dataEntrega) return;
      const mundo = p.mundo?.trim().toUpperCase() || "SEM MUNDO";
      totalVolumes += p.quantidade;
      if (p.notaFiscal) notasSet.add(p.notaFiscal.trim());
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);
    });

    return {
      totalVolumes, 
      totalNotas: notasSet.size,
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })),
    };
  }, [todosPedidos]);

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <h1 className="text-3xl font-bold">Histórico de Entregas</h1>

        <Card className="p-4 border-emerald-100 bg-emerald-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-emerald-800 uppercase mb-1 block">Banco de Dados Histórico</span>
            <Input value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white" />
          </div>
          <div className="flex gap-2 pt-5">
            {!isVinculado ? (
              <button onClick={() => { refetch(); setIsVinculado(true); sessionStorage.setItem("url_historico", urlPlanilha); sessionStorage.setItem("vinculado_historico", "true"); }} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold">Vincular</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => refetch()} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold">Atualizar</button>
                <button onClick={() => { setIsVinculado(false); sessionStorage.removeItem("url_historico"); sessionStorage.removeItem("vinculado_historico"); }} className="p-2.5 text-slate-400 bg-white rounded-lg border"><X /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase">Volumes Recebidos</p>
                <h3 className="text-3xl font-black">{kpis.totalVolumes}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-purple-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase">Notas Processadas</p>
                <h3 className="text-3xl font-black">{kpis.totalNotas}</h3>
              </Card>
              <Card className="p-5 border-t-4 border-t-orange-500 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase">Diversidade de SKUs</p>
                <h3 className="text-3xl font-black">{kpis.grafSkusMundo.length}</h3>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest text-center">Distribuição Histórica por Mundo</h3>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie data={kpis.grafSkusMundo} cx="50%" cy="40%" innerRadius={70} outerRadius={110} dataKey="value">
                      {kpis.grafSkusMundo.map((entry, i) => (
                        <Cell key={i} fill={MUNDO_COLORS[entry.name.toUpperCase()] || COR_PADRAO} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '25px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}