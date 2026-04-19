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

// 🎨 PALETA DE CORES VIBRANTES (PADRONIZADA)
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
    
    // 🚀 ORDENAÇÃO: Por Remetente (A-Z) e depois por Nota Fiscal
    const listaOrdenada = [...futuros].sort((a, b) => {
      const remA = (a.remetente || "").toUpperCase();
      const remB = (b.remetente || "").toUpperCase();
      if (remA !== remB) return remA.localeCompare(remB);

      const notaA = (a.notaFiscal || "").toUpperCase();
      const notaB = (b.notaFiscal || "").toUpperCase();
      return notaA.localeCompare(notaB);
    });

    let totalVolumesFisicos = 0;
    const notasEmTransitoSet = new Set<string>();
    const skusPorMundo: Record<string, Set<string>> = {};
    const volumesPorRemetente: Record<string, number> = {};

    listaOrdenada.forEach((p) => {
      totalVolumesFisicos += p.quantidade;
      if (p.notaFiscal) notasEmTransitoSet.add(p.notaFiscal);
      const mundo = p.mundo?.trim().toUpperCase() || "SEM MUNDO";
      if (!skusPorMundo[mundo]) skusPorMundo[mundo] = new Set();
      skusPorMundo[mundo].add(p.produtoSku);
      const remetente = p.remetente || "Desconhecido";
      volumesPorRemetente[remetente] = (volumesPorRemetente[remetente] || 0) + p.quantidade;
    });

    return {
      listaRecebimento: listaOrdenada, 
      totalVolumesFisicos, 
      notasEmTransito: notasEmTransitoSet.size,
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })).sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(volumesPorRemetente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos]);

  // 🚀 IMPRESSÃO OTIMIZADA PARA A4 COM CÉLULAS PINTADAS
  const gerarRelatorioImpressao = () => {
    if (kpis.listaRecebimento.length === 0) return toast.warning("Não há dados.");
    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) return toast.error("Habilite popups.");

    const htmlRelatorio = `
      <html>
        <head>
          <title>Recebimento Futuro - T Store</title>
          <style>
            @page { size: A4 portrait; margin: 1cm; }
            body { font-family: sans-serif; font-size: 10px; color: #000; margin: 0; padding: 0; }
            .header { border-bottom: 2px solid #000; margin-bottom: 15px; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: flex-end; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 6px 4px; text-align: left; word-wrap: break-word; }
            th { background-color: #eee !important; -webkit-print-color-adjust: exact; font-weight: bold; text-transform: uppercase; }
            
            /* 🚀 COLUNAS LARGURA DINÂMICA */
            .col-rem { width: 18%; }
            .col-desc { width: 27%; }
            .col-ref { width: 12%; }
            .col-mundo { width: 15%; text-align: center; }
            .col-nf { width: 18%; }
            .col-qtd { width: 10%; text-align: right; }

            /* 🚀 ESTILO DA CÉLULA PINTADA */
            .mundo-cell { 
                font-weight: bold; 
                text-transform: uppercase; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin:0; font-size: 16px;">T STORE - RECEBIMENTO FUTURO</h1>
            <span>Emissão: ${new Date().toLocaleString('pt-BR')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="col-rem">Remetente</th>
                <th class="col-desc">Descrição</th>
                <th class="col-ref">Ref.</th>
                <th class="col-mundo">Mundo</th>
                <th class="col-nf">Nota Fiscal</th>
                <th class="col-qtd">Qtde</th>
              </tr>
            </thead>
            <tbody>
              ${kpis.listaRecebimento.map(item => {
                const cor = MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO;
                return `
                  <tr>
                    <td>${item.remetente || '-'}</td>
                    <td>${item.descricao || '-'}</td>
                    <td style="font-family: monospace;">${item.produtoSku}</td>
                    <td class="mundo-cell" style="background-color: ${cor} !important;">
                      ${item.mundo || '-'}
                    </td>
                    <td><b>${item.notaFiscal || '-'}</b></td>
                    <td style="text-align: right;"><b>${item.quantidade}</b></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
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
        toast.success("Vinculado com sucesso!");
      }
    } finally {
      setIsSincronizando(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recebimento Futuro</h1>
            <p className="text-gray-600">Gestão de mercadorias em trânsito</p>
          </div>
          {isVinculado && (
            <button onClick={gerarRelatorioImpressao} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-all">
              <Printer size={20} /> Imprimir A4
            </button>
          )}
        </div>

        {/* INPUT DE VÍNCULO */}
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
                <button onClick={() => refetch()} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md">
                  <RefreshCw size={18} /> Atualizar
                </button>
                <button onClick={() => {setIsVinculado(false); setUrlPlanilha(""); sessionStorage.clear();}} className="p-2.5 text-slate-400 hover:text-red-600 bg-white rounded-lg border border-slate-200"><X size={20} /></button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* GRÁFICOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest text-center">SKUs por Mundo</h3>
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
                <h3 className="font-bold text-gray-800 mb-6 uppercase text-sm tracking-widest text-center">Volumes por Remetente</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={kpis.grafRemetente} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="flex justify-center">
              <button onClick={() => setMostrarLista(!mostrarLista)} className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-all">
                {mostrarLista ? "Ocultar Lista" : "Ver Lista Organizada"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="overflow-hidden border-slate-200 shadow-xl">
                <div className="overflow-x-auto max-h-[550px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 sticky top-0 uppercase text-[10px] font-black text-slate-600 border-b">
                      <tr>
                        <th className="px-4 py-4">Remetente</th>
                        <th className="px-4 py-4">Descrição</th>
                        <th className="px-4 py-4">Ref.</th>
                        <th className="px-4 py-4">Mundo</th>
                        <th className="px-4 py-4">Nota Fiscal</th>
                        <th className="px-4 py-4 text-right">Qtde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpis.listaRecebimento.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-700">{item.remetente || '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{item.descricao || '-'}</td>
                          <td className="px-4 py-3 font-mono text-[11px]">{item.produtoSku}</td>
                          <td className="px-4 py-3">
                            <span 
                                className="px-2 py-1 rounded text-[10px] font-black uppercase text-slate-900" 
                                style={{ backgroundColor: MUNDO_COLORS[(item.mundo || "").toUpperCase()] || COR_PADRAO }}
                            >
                                {item.mundo || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{item.notaFiscal || '-'}</td>
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