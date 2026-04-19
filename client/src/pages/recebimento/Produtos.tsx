/**
 * client/src/pages/recebimento/Produtos.tsx
 */

import { useState, useMemo } from "react";
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
  const [urlPlanilha, setUrlPlanilha] = useState("");
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<number>(0);

  // 🚀 MODO RECEBIMENTO ATIVADO AQUI
  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'recebimento' }, 
    { enabled: false }
  );

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
              <tr><th>Remetente</th><th>NF</th><th>SKU</th><th>Descrição</th><th>Mundo</th><th>Qtd</th></tr>
            </thead>
            <tbody>
              ${kpis.listaRecebimento.map(item => `
                <tr>
                  <td>${item.remetente || '-'}</td>
                  <td>${item.notaFiscal || '-'}</td>
                  <td>${item.produtoSku}</td>
                  <td>${item.descricao || '-'}</td>
                  <td>${item.mundo || '-'}</td>
                  <td>${item.quantidade * (item.qtdePorCaixa || 1)}</td>
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
    if (!urlPlanilha) return toast.warning("Insira o link da planilha.");
    setIsSincronizando(true);
    const result = await refetch();
    if (!result.isError) {
      toast.success("Dados carregados!");
      setIsVinculado(true);
      setUltimaSincronizacao(Date.now());
    }
    setIsSincronizando(false);
  };

  const handleAtualizar = async () => {
    const agora = Date.now();
    if (ultimaSincronizacao !== 0 && (agora - ultimaSincronizacao) < 30000) {
      return toast.warning("Aguarde 30s para atualizar novamente.");
    }
    setIsSincronizando(true);
    await refetch();
    setUltimaSincronizacao(Date.now());
    toast.success("Atualizado!");
    setIsSincronizando(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recebimento Futuro</h1>
            <p className="text-gray-600">Mercadorias em trânsito para a loja</p>
          </div>
          {isVinculado && (
            <button onClick={gerarRelatorioImpressao} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-md">
              <Printer size={18} /> Imprimir Relatório
            </button>
          )}
        </div>

        <Card className="p-4 border-blue-100 bg-blue-50/50 flex gap-4 items-center">
          <Input 
            placeholder="Link da planilha de Recebimento..." 
            value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} 
            disabled={isVinculado} className="flex-1 bg-white" 
          />
          {!isVinculado ? (
            <button onClick={handleVincular} disabled={isSincronizando} className="bg-blue-600 text-white px-6 py-2.5 rounded-md font-medium">Vincular</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleAtualizar} disabled={isSincronizando} className="bg-emerald-600 text-white px-6 py-2.5 rounded-md font-medium flex items-center gap-2">
                <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
              </button>
              <button onClick={() => { setIsVinculado(false); setUrlPlanilha(""); }} className="bg-red-100 text-red-700 px-3 py-2.5 rounded-md"><X size={18} /></button>
            </div>
          )}
        </Card>

        {isVinculado && (
          <div className="space-y-6">
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
              <Card className="p-6"><h3 className="font-bold mb-4">SKUs por Mundo</h3><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={kpis.grafSkusMundo} innerRadius={60} outerRadius={80} dataKey="value">{kpis.grafSkusMundo.map((_, i) => <Cell key={i} fill={CORES_MUNDO[i % CORES_MUNDO.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Card>
              <Card className="p-6"><h3 className="font-bold mb-4">Top Remetentes (Volumes)</h3><ResponsiveContainer width="100%" height={250}><BarChart data={kpis.grafRemetente} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></Card>
            </div>

            <div className="flex justify-center">
              <button onClick={() => setMostrarLista(!mostrarLista)} className="flex items-center gap-2 bg-slate-100 px-8 py-3 rounded-full font-bold shadow-sm">
                {mostrarLista ? <ChevronUp size={20} /> : <ChevronDown size={20} />} {mostrarLista ? "Ocultar Detalhes" : "Ver Detalhes dos Itens"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 uppercase text-[10px] font-bold text-slate-500">
                      <tr><th className="px-4 py-3">Remetente</th><th className="px-4 py-3">Nota</th><th className="px-4 py-3">Ref</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Qtd</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {kpis.listaRecebimento.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3">{item.remetente || '-'}</td>
                          <td className="px-4 py-3 font-medium">{item.notaFiscal || '-'}</td>
                          <td className="px-4 py-3 font-mono">{item.produtoSku}</td>
                          <td className="px-4 py-3 text-xs">{item.descricao}</td>
                          <td className="px-4 py-3 text-right font-bold">{item.quantidade * (item.qtdePorCaixa || 1)}</td>
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