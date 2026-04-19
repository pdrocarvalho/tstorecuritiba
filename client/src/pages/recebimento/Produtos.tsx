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

// 🎨 MAPEAMENTO DE CORES PADRONIZADO
const MUNDO_COLORS: Record<string, string> = {
  "CORTAR": "#f4cccc",
  "FESTEJAR": "#8e7cc3",
  "PREPARAR": "#d9ead3",
  "SERVIR": "#fff2cc",
  "EQUIPAR": "#6fa8dc"
};
const COR_PADRAO = "#e2e8f0";

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

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    futuros.forEach((p) => {
      totalVolumesFisicos += p.quantidade;
      if (p.notaFiscal) notasEmTransitoSet.add(p.notaFiscal);
      if (p.previsaoEntrega) {
        const previsao = new Date(p.previsaoEntrega);
        if (previsao < hoje && p.notaFiscal) notasAtrasadasSet.add(p.notaFiscal);
      }
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
      atrasados: notasAtrasadasSet.size,
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recebimento Futuro</h1>
            <p className="text-gray-600">Mercadorias em trânsito para a loja</p>
          </div>
        </div>

        <Card className="p-4 border-blue-100 bg-blue-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase mb-1 block">Fonte de Dados</span>
            <Input value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white border-blue-200" />
          </div>
          <div className="flex gap-2 pt-5">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold">
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />} Vincular
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => refetch()} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold flex gap-2">
                  <RefreshCw size={18} /> Atualizar
                </button>
                <button onClick={handleCancelar} className="p-2.5 text-slate-400 hover:text-red-600 bg-white rounded-lg border border-slate-200"><X size={20} /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-l-4 border-l-blue-500 flex justify-between items-center">
                <div><p className="text-xs font-bold text-gray-500 uppercase">Total a Receber</p><h3 className="text-3xl font-black">{kpis.totalVolumesFisicos}</h3></div>
                <Package className="text-blue-200" size={40} />
              </Card>
              <Card className="p-6 border-l-4 border-l-emerald-500 flex justify-between items-center">
                <div><p className="text-xs font-bold text-gray-500 uppercase">Notas em Trânsito</p><h3 className="text-3xl font-black">{kpis.notasEmTransito}</h3></div>
                <Truck className="text-emerald-200" size={40} />
              </Card>
              <Card className="p-6 border-l-4 border-l-red-500 flex justify-between items-center">
                <div><p className="text-xs font-bold text-gray-500 uppercase">Em Atraso</p><h3 className="text-3xl font-black text-red-600">{kpis.atrasados}</h3></div>
                <AlertTriangle className="text-red-200" size={40} />
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">SKUs por Mundo</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={kpis.grafSkusMundo} cx="50%" cy="40%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                        {kpis.grafSkusMundo.map((entry, i) => (
                          <Cell key={i} fill={MUNDO_COLORS[entry.name.toUpperCase()] || COR_PADRAO} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '15px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">Top Remetentes (Volumes)</h3>
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
              <button onClick={() => setMostrarLista(!mostrarLista)} className="bg-slate-100 px-8 py-3 rounded-full font-bold shadow-sm">
                {mostrarLista ? "Ocultar Detalhes" : "Ver Detalhes dos Itens"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 uppercase text-[10px] font-bold text-slate-500 border-b">
                      <tr><th className="px-4 py-3">Mundo</th><th className="px-4 py-3">Remetente</th><th className="px-4 py-3">Nota</th><th className="px-4 py-3">Ref</th><th className="px-4 py-3 text-right">Qtd</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpis.listaRecebimento.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            {/* 🚀 CORREÇÃO DO ERRO TS AQUI: Usando fallback para string vazia */}
                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO }}></span>
                            <span className="text-[10px] font-bold uppercase">{item.mundo || '-'}</span>
                          </td>
                          <td className="px-4 py-3">{item.remetente || '-'}</td>
                          <td className="px-4 py-3 font-medium">{item.notaFiscal || '-'}</td>
                          <td className="px-4 py-3 font-mono">{item.produtoSku}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">{item.quantidade}</td>
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