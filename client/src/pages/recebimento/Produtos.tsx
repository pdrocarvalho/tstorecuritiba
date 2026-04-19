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

const CORES_MUNDO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function RecebimentoFuturo() {
  // 🚀 PERSISTÊNCIA: Inicializa estados buscando no baú da sessão
  const [urlPlanilha, setUrlPlanilha] = useState(() => {
    return sessionStorage.getItem("url_recebimento") || "";
  });

  const [isVinculado, setIsVinculado] = useState(() => {
    return sessionStorage.getItem("vinculado_recebimento") === "true";
  });

  const [isSincronizando, setIsSincronizando] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  // 🚀 QUERY: Habilitada automaticamente se já houver link salvo
  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: isVinculado && !!urlPlanilha }
  );

  // 🚀 AUTO-LOAD: Recarrega os dados ao alternar abas
  useEffect(() => {
    if (isVinculado && urlPlanilha) {
      refetch();
    }
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
      const mundo = p.mundo || "Sem Mundo";
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
    if (!urlPlanilha) return toast.warning("Insira o link da planilha.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error("Erro ao acessar a planilha.");
      } else {
        setIsVinculado(true);
        sessionStorage.setItem("url_recebimento", urlPlanilha);
        sessionStorage.setItem("vinculado_recebimento", "true");
        toast.success("Recebimento vinculado!");
        setUltimaSincronizacao(Date.now());
      }
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    sessionStorage.removeItem("url_recebimento");
    sessionStorage.removeItem("vinculado_recebimento");
    setMostrarLista(false);
    toast.info("Vínculo removido.");
  };

  const handleAtualizar = async () => {
    const agora = Date.now();
    if (ultimaSincronizacao !== 0 && (agora - ultimaSincronizacao) < 30000) {
      return toast.warning("Aguarde 30s.");
    }
    setIsSincronizando(true);
    await refetch();
    setUltimaSincronizacao(Date.now());
    toast.success("Dados atualizados!");
    setIsSincronizando(false);
  };

  const gerarRelatorioImpressao = () => {
    if (kpis.listaRecebimento.length === 0) return toast.warning("Não há dados para imprimir.");
    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) return toast.error("Habilite popups para imprimir.");

    const htmlRelatorio = `
      <html>
        <head>
          <title>Relatório de Recebimento Futuro</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Relatório: Recebimento Futuro</h1>
          <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          <table>
            <thead>
              <tr><th>Remetente</th><th>NF</th><th>SKU</th><th>Qtd</th></tr>
            </thead>
            <tbody>
              ${kpis.listaRecebimento.map(item => `
                <tr>
                  <td>${item.remetente || '-'}</td>
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

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Recebimento Futuro</h1>
            <p className="text-gray-600">Mercadorias em trânsito para a loja</p>
          </div>
          {isVinculado && (
            <button onClick={gerarRelatorioImpressao} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-slate-800 transition-all active:scale-95">
              <Printer size={18} /> Imprimir Relatório
            </button>
          )}
        </div>

        <Card className="p-4 border-blue-100 bg-blue-50/50 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase mb-1 block">Fonte de Dados</span>
            <Input 
              placeholder="Link da planilha do Google Sheets..." 
              value={urlPlanilha} 
              onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado} className="bg-white border-blue-200" 
            />
          </div>
          <div className="flex items-end gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button 
                onClick={handleVincular} 
                disabled={isSincronizando} 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold min-w-[140px] shadow-md transition-all"
              >
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />}
                {isSincronizando ? "Vinculando..." : "Vincular"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAtualizar} 
                  disabled={isSincronizando} 
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> 
                  {isSincronizando ? "Lendo..." : "Atualizar"}
                </button>
                <button 
                  onClick={handleCancelar} 
                  className="p-2.5 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-200"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-l-4 border-l-blue-500 flex justify-between items-center shadow-sm">
                <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total a Receber</p><h3 className="text-3xl font-black">{kpis.totalVolumesFisicos}</h3></div>
                <Package className="text-blue-200" size={40} />
              </Card>
              <Card className="p-6 border-l-4 border-l-emerald-500 flex justify-between items-center shadow-sm">
                <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas em Trânsito</p><h3 className="text-3xl font-black">{kpis.notasEmTransito}</h3></div>
                <Truck className="text-emerald-200" size={40} />
              </Card>
              <Card className="p-6 border-l-4 border-l-red-500 flex justify-between items-center shadow-sm">
                <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Em Atraso</p><h3 className="text-3xl font-black text-red-600">{kpis.atrasados}</h3></div>
                <AlertTriangle className="text-red-200" size={40} />
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">SKUs por Mundo</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie 
                        data={kpis.grafSkusMundo} 
                        cx="50%" 
                        cy="42%" 
                        innerRadius={60} 
                        outerRadius={85} 
                        paddingAngle={5} 
                        dataKey="value"
                      >
                        {kpis.grafSkusMundo.map((_, i) => (
                          <Cell key={i} fill={CORES_MUNDO[i % CORES_MUNDO.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '15px' }}
                      />
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
              <button 
                onClick={() => setMostrarLista(!mostrarLista)} 
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-8 py-3 rounded-full font-bold shadow-sm transition-all"
              >
                {mostrarLista ? <ChevronUp size={20} /> : <ChevronDown size={20} />} {mostrarLista ? "Ocultar Detalhes" : "Ver Detalhes dos Itens"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="overflow-hidden shadow-md border-slate-200">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 sticky top-0 uppercase text-[10px] font-bold text-slate-500 border-b">
                      <tr><th className="px-4 py-3">Remetente</th><th className="px-4 py-3">Nota</th><th className="px-4 py-3">Ref</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Qtd</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpis.listaRecebimento.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">{item.remetente || '-'}</td>
                          <td className="px-4 py-3 font-medium">{item.notaFiscal || '-'}</td>
                          <td className="px-4 py-3 font-mono">{item.produtoSku}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{item.descricao}</td>
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