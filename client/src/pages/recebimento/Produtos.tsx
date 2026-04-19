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

// 🎨 PALETA DE CORES VIBRANTES
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

  const gerarRelatorioImpressao = () => {
    if (kpis.listaRecebimento.length === 0) return toast.warning("Não há dados para imprimir.");
    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) return toast.error("Habilite popups para imprimir.");

    const htmlRelatorio = `
      <html>
        <head>
          <title>Relatório de Recebimento Futuro</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 11px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f8f9fa; font-weight: bold; text-transform: uppercase; font-size: 10px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Relatório: Recebimento Futuro</h2>
            <span>Gerado em: ${new Date().toLocaleString('pt-BR')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Remetente</th>
                <th>Descrição</th>
                <th>Mundo</th>
                <th>Nota Fiscal</th>
                <th>Ref.</th>
                <th>Qtde</th>
              </tr>
            </thead>
            <tbody>
              ${kpis.listaRecebimento.map(item => `
                <tr>
                  <td>${item.remetente || '-'}</td>
                  <td>${item.descricao || '-'}</td>
                  <td>${item.mundo || '-'}</td>
                  <td>${item.notaFiscal || '-'}</td>
                  <td>${item.produtoSku}</td>
                  <td>${item.quantidade}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;
    janelaImpressao.document.write(htmlRelatorio);
    janelaImpressao.document.close();
  };

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
          
          {isVinculado && (
            <button 
              onClick={gerarRelatorioImpressao} 
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95"
            >
              <Printer size={18} /> Imprimir Relatório
            </button>
          )}
        </div>

        <Card className="p-4 border-blue-100 bg-blue-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase mb-1 block">Fonte de Dados</span>
            <Input value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white border-blue-200" />
          </div>
          <div className="flex gap-2 pt-5">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2">
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />} Vincular
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => refetch()} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">
                  <RefreshCw size={18} /> Atualizar
                </button>
                <button onClick={handleCancelar} className="p-2.5 text-slate-400 hover:text-red-600 bg-white rounded-lg border border-slate-200"><X size={20} /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
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
              <button onClick={() => setMostrarLista(!mostrarLista)} className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-all">
                {mostrarLista ? "Ocultar Detalhes" : "Ver Detalhes dos Itens"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="overflow-hidden border-slate-200 shadow-xl">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 sticky top-0 uppercase text-[10px] font-black text-slate-600 border-b">
                      {/* 🚀 ORDEM DAS COLUNAS ATUALIZADA */}
                      <tr>
                        <th className="px-4 py-4">Remetente</th>
                        <th className="px-4 py-4">Descrição</th>
                        <th className="px-4 py-4">Mundo</th>
                        <th className="px-4 py-4">Nota Fiscal</th>
                        <th className="px-4 py-4">Ref.</th>
                        <th className="px-4 py-4 text-right">Qtde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpis.listaRecebimento.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          {/* 1. REMETENTE */}
                          <td className="px-4 py-3 text-slate-600">{item.remetente || '-'}</td>
                          
                          {/* 2. DESCRIÇÃO (Adicionada) */}
                          <td className="px-4 py-3 text-xs text-slate-500 italic max-w-xs truncate">{item.descricao || '-'}</td>
                          
                          {/* 3. MUNDO */}
                          <td className="px-4 py-3">
                            <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ backgroundColor: MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO }}></span>
                            <span className="text-[10px] font-black uppercase">{item.mundo || '-'}</span>
                          </td>
                          
                          {/* 4. NOTA FISCAL */}
                          <td className="px-4 py-3 font-bold text-slate-900">{item.notaFiscal || '-'}</td>
                          
                          {/* 5. REF. */}
                          <td className="px-4 py-3 font-mono text-xs">{item.produtoSku}</td>
                          
                          {/* 6. QTDE */}
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