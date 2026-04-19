/**
 * client/src/pages/recebimento/Produtos.tsx
 */

import { useState, useMemo, useEffect } from "react"; // 🚀 Adicionado useEffect
import { 
  Link2, RefreshCw, X, Package, Truck, AlertTriangle, 
  ChevronDown, ChevronUp, TableProperties, Printer 
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
  // 🚀 INICIALIZAÇÃO: Verifica se já existe um link no baú da sessão
  const [urlPlanilha, setUrlPlanilha] = useState(() => {
    return sessionStorage.getItem("url_recebimento") || "";
  });
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: false }
  );

  // 🚀 AUTO-CONEXÃO: Reestabelece o vínculo ao trocar de aba
  useEffect(() => {
    if (urlPlanilha) {
      handleVincular(true);
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

  const gerarRelatorioImpressao = () => {
    if (kpis.listaRecebimento.length === 0) return toast.warning("Não há dados para imprimir.");
    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) return toast.error("Habilite popups.");

    const htmlRelatorio = `
      <html>
        <head><title>Relatório de Recebimento</title><style>body{font-family:sans-serif;padding:20px;font-size:12px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px;}</style></head>
        <body>
          <h1>Recebimento Futuro</h1>
          <table><thead><tr><th>Remetente</th><th>NF</th><th>SKU</th><th>Qtd</th></tr></thead>
          <tbody>${kpis.listaRecebimento.map(item => `<tr><td>${item.remetente}</td><td>${item.notaFiscal}</td><td>${item.produtoSku}</td><td>${item.quantidade}</td></tr>`).join('')}</tbody></table>
          <script>window.print(); window.close();</script>
        </body>
      </html>`;
    janelaImpressao.document.write(htmlRelatorio);
    janelaImpressao.document.close();
  };

  // 🚀 ATUALIZADO: Salva no sessionStorage ao vincular
  const handleVincular = async (silencioso = false) => {
    if (!urlPlanilha) return;
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (!result.isError) {
        setIsVinculado(true);
        sessionStorage.setItem("url_recebimento", urlPlanilha);
        if (!silencioso) toast.success("Recebimento sincronizado!");
        setUltimaSincronizacao(Date.now());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleAtualizar = async () => {
    const agora = Date.now();
    if (ultimaSincronizacao !== 0 && (agora - ultimaSincronizacao) < 30000) {
      return toast.warning("Aguarde 30s para atualizar.");
    }
    setIsSincronizando(true);
    await refetch();
    setUltimaSincronizacao(Date.now());
    toast.success("Dados atualizados!");
    setIsSincronizando(false);
  };

  // 🚀 ATUALIZADO: Limpa o sessionStorage ao cancelar
  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    sessionStorage.removeItem("url_recebimento");
    setMostrarLista(false);
    setUltimaSincronizacao(0);
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
            <button onClick={gerarRelatorioImpressao} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-md">
              <Printer size={18} /> Imprimir Relatório
            </button>
          )}
        </div>

        <Card className="p-4 border-blue-100 bg-blue-50/50 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1 block">Fonte de Dados</span>
            <Input 
              placeholder="Cole o link da planilha..." 
              value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado} className="bg-white border-blue-200" 
            />
          </div>
          <div className="flex items-end gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button 
                onClick={() => handleVincular(false)} 
                disabled={isSincronizando} 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold min-w-[140px]"
              >
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />}
                {isSincronizando ? "Vinculando..." : "Vincular"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAtualizar} 
                  disabled={isSincronizando} 
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2"
                >
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> 
                  {isSincronizando ? "Lendo..." : "Atualizar"}
                </button>
                <button onClick={handleCancelar} className="p-2.5 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm">
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* ... Restante da página (KPIs, Gráficos, Tabela) mantidos como antes ... */}
        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-l-4 border-l-blue-500 flex justify-between items-center shadow-sm">
                <div><p className="text-xs font-bold text-gray-500 uppercase">Total a Receber</p><h3 className="text-3xl font-black">{kpis.totalVolumesFisicos}</h3></div>
                <Package className="text-blue-200" size={40} />
              </Card>
              <Card className="p-6 border-l-4 border-l-emerald-500 flex justify-between items-center shadow-sm">
                <div><p className="text-xs font-bold text-gray-500 uppercase">Notas em Trânsito</p><h3 className="text-3xl font-black">{kpis.notasEmTransito}</h3></div>
                <Truck className="text-emerald-200" size={40} />
              </Card>
              <Card className="p-6 border-l-4 border-l-red-500 flex justify-between items-center shadow-sm">
                <div><p className="text-xs font-bold text-gray-500 uppercase">Em Atraso</p><h3 className="text-3xl font-black text-red-600">{kpis.atrasados}</h3></div>
                <AlertTriangle className="text-red-200" size={40} />
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm"><h3 className="font-bold mb-4">SKUs por Mundo</h3><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={kpis.grafSkusMundo} innerRadius={60} outerRadius={80} dataKey="value">{kpis.grafSkusMundo.map((_, i) => <Cell key={i} fill={CORES_MUNDO[i % CORES_MUNDO.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Card>
              <Card className="p-6 shadow-sm"><h3 className="font-bold mb-4">Top Remetentes (Volumes)</h3><ResponsiveContainer width="100%" height={250}><BarChart data={kpis.grafRemetente} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></Card>
            </div>

            <div className="flex justify-center">
              <button onClick={() => setMostrarLista(!mostrarLista)} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-8 py-3 rounded-full font-bold shadow-sm transition-all">
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
                          <td className="px-4 py-3 text-right font-bold text-blue-600">{item.quantidade * (item.qtdePorCaixa || 1)}</td>
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