/**
 * client/src/pages/recebimento/Produtos.tsx
 */

import { useState, useMemo, useEffect } from "react";
import { 
  Link2, RefreshCw, X, Package, Truck, AlertTriangle, 
  ChevronDown, ChevronUp, Printer 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, Legend 
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

export default function RecebimentoFuturo() {
  const [urlPlanilha, setUrlPlanilha] = useState(() => sessionStorage.getItem("url_recebimento") || "");
  const [isVinculado, setIsVinculado] = useState(() => sessionStorage.getItem("vinculado_rece_futuro") === "true");
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado && !!urlPlanilha }
  );

  useEffect(() => {
    if (isVinculado && urlPlanilha) refetch();
  }, []);

  const kpis = useMemo(() => {
    const futuros = (todosPedidos as Pedido[]).filter((p) => !p.dataEntrega);
    let totalVolumesFisicos = 0;
    const notasEmTransitoSet = new Set<string>();
    const notasAtrasadasSet = new Set<string>();
    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    futuros.forEach((p) => {
      totalVolumesFisicos += p.quantidade;
      if (p.notaFiscal) notasEmTransitoSet.add(p.notaFiscal);
      
      const mundo = p.mundo?.trim().toUpperCase() || "SEM MUNDO";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);
      
      const remetente = p.remetente || "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    return {
      listaRecebimento: futuros, 
      totalVolumesFisicos, 
      notasEmTransito: notasEmTransitoSet.size,
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })).sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(volumesPorRemetente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos]);

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Insira o link.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (!result.isError) {
        setIsVinculado(true);
        sessionStorage.setItem("url_recebimento", urlPlanilha);
        sessionStorage.setItem("vinculado_rece_futuro", "true");
        toast.success("Recebimento vinculado!");
      }
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    sessionStorage.removeItem("url_recebimento");
    sessionStorage.removeItem("vinculado_rece_futuro");
    toast.info("Vínculo removido.");
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <h1 className="text-3xl font-bold text-gray-900">Recebimento Futuro</h1>

        <Card className="p-4 border-blue-100 bg-blue-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase mb-1 block">Fonte de Dados</span>
            <Input value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white" />
          </div>
          <div className="flex gap-2 pt-5">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold">
                {isSincronizando ? <RefreshCw className="animate-spin" /> : <Link2 />} Vincular
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => refetch()} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold">Atualizar</button>
                <button onClick={handleCancelar} className="p-2.5 text-slate-400 bg-white rounded-lg border"><X /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest">SKUs por Mundo</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={kpis.grafSkusMundo} cx="50%" cy="40%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                        {kpis.grafSkusMundo.map((entry, i) => (
                          <Cell key={i} fill={MUNDO_COLORS[entry.name.toUpperCase()] || COR_PADRAO} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '15px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest">Volumes por Remetente</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={kpis.grafRemetente} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="flex justify-center">
              <button onClick={() => setMostrarLista(!mostrarLista)} className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold">
                {mostrarLista ? "Ocultar Detalhes" : "Ver Detalhes dos Itens"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 sticky top-0 uppercase text-[10px] font-black text-slate-600 border-b">
                      <tr><th className="px-4 py-4">Mundo</th><th className="px-4 py-4">Remetente</th><th className="px-4 py-4">Nota</th><th className="px-4 py-4">Ref</th><th className="px-4 py-4 text-right">Qtd</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpis.listaRecebimento.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ backgroundColor: MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO }}></span>
                            <span className="text-[10px] font-black uppercase">{item.mundo || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.remetente || '-'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{item.notaFiscal || '-'}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.produtoSku}</td>
                          <td className="px-4 py-3 text-right font-black text-blue-600">{item.quantidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}