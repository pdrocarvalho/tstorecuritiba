/**
 * client/src/pages/recebimento/Produtos.tsx
 */

import { useState, useMemo } from "react";
import { Link2, RefreshCw, X, Package, Truck, AlertTriangle, ChevronDown, ChevronUp, TableProperties, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner"; 
import type { Pedido } from "@/types";

const CORES_MUNDO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function RecebimentoFuturo() {
  const [urlPlanilha, setUrlPlanilha] = useState("");
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);

  const { data: todosPedidos = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha }, 
    { enabled: false }
  );

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Por favor, insira o link da planilha.");
    if (!urlPlanilha.includes("docs.google.com/spreadsheets")) return toast.error("Link inválido. Certifique-se de colar um link válido do Google Sheets.");

    setIsSincronizando(true);
    
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error(`Falha no acesso: ${result.error?.message}`);
        setIsVinculado(false);
      } else if (result.data && result.data.length === 0) {
        toast.warning("A planilha foi lida, mas está vazia ou não possui as colunas necessárias.");
        setIsVinculado(true);
      } else {
        toast.success("Planilha vinculada e dados carregados com sucesso!");
        setIsVinculado(true);
      }
    } catch (error) {
      toast.error("Erro inesperado de conexão.");
      setIsVinculado(false);
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleAtualizar = async () => {
    setIsSincronizando(true);
    const result = await refetch();
    if (result.isError) {
      toast.error(`Falha ao atualizar: ${result.error?.message}`);
    } else {
      toast.success("Tabela atualizada com a versão mais recente!");
    }
    setIsSincronizando(false);
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    setMostrarLista(false);
    toast.info("Planilha desvinculada. Tela limpa.");
  };

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
      listaRecebimento: futuros, totalVolumesFisicos, notasEmTransito: notasEmTransitoSet.size,
      atrasados: notasAtrasadasSet.size,
      grafSkusMundo: Object.entries(skusPorMundo).map(([name, skus]) => ({ name, value: skus.size })).sort((a, b) => b.value - a.value),
      grafRemetente: Object.entries(volumesPorRemetente).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    };
  }, [todosPedidos]);

  // 🚀 A NOVA FUNÇÃO DE EXPORTAÇÃO
  const handleExportarCSV = () => {
    if (kpis.listaRecebimento.length === 0) {
      toast.warning("Não há dados para exportar.");
      return;
    }

    const headers = ["Remetente", "Nota Fiscal", "Ref. (SKU)", "Descrição", "Mundo", "Qtd. Total", "Previsão"];
    
    const rows = kpis.listaRecebimento.map(item => {
      const qtdTotalUnitaria = item.quantidade * (item.qtdePorCaixa || 1);
      const previsao = item.previsaoEntrega ? new Date(item.previsaoEntrega).toLocaleDateString('pt-BR') : '-';
      
      return [
        `"${item.remetente || '-'}"`,
        `"${item.notaFiscal || '-'}"`,
        `"${item.produtoSku}"`,
        `"${(item.descricao || 'Sem descrição').replace(/"/g, '""')}"`, 
        `"${item.mundo || '-'}"`,
        qtdTotalUnitaria,
        `"${previsao}"`
      ].join(";"); // Usamos ponto e vírgula para o Excel abrir direto em PT-BR
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.setAttribute("download", `Recebimento_Futuro_${dataAtual}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Relatório baixado com sucesso!");
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recebimento Futuro</h1>
          <p className="text-gray-600 mt-1">Gestão inteligente e sob demanda das mercadorias em trânsito</p>
        </div>

        <Card className="p-4 border border-blue-100 bg-blue-50/50 shadow-sm flex flex-col md:flex-row gap-4 items-center transition-all duration-300">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1 block">Fonte de Dados (Google Sheets)</span>
            <Input 
              placeholder="Cole o link da planilha aqui..." 
              value={urlPlanilha} 
              onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado}
              className="bg-white border-blue-200 focus-visible:ring-blue-500"
            />
          </div>
          
          <div className="flex items-end gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-md font-medium transition-colors">
                {isSincronizando ? <RefreshCw size={18} className="animate-spin" /> : <Link2 size={18} />} 
                {isSincronizando ? "Lendo..." : "Vincular"}
              </button>
            ) : (
              <>
                <button onClick={handleAtualizar} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors disabled:opacity-50">
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> {isSincronizando ? "Lendo..." : "Atualizar"}
                </button>
                <button onClick={handleCancelar} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-6 py-2.5 rounded-md font-medium transition-colors">
                  <X size={18} /> Cancelar
                </button>
              </>
            )}
          </div>
        </Card>

        {!isVinculado && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <TableProperties size={64} className="mb-4 text-gray-300" />
            <h3 className="text-xl font-medium text-gray-500">Nenhuma planilha vinculada</h3>
            <p className="text-sm mt-2 text-center max-w-md">Insira o link da sua planilha e clique em Vincular para carregar os indicadores analíticos.</p>
          </div>
        )}

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total a Receber</p>
                  <h3 className="text-3xl font-extrabold text-gray-900">{kpis.totalVolumesFisicos}</h3>
                  <p className="text-xs text-gray-400 mt-1">volumes / caixas físicas</p>
                </div>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Package size={28} /></div>
              </Card>

              <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Notas em Trânsito</p>
                  <h3 className="text-3xl font-extrabold text-gray-900">{kpis.notasEmTransito}</h3>
                  <p className="text-xs text-gray-400 mt-1">NFs únicas identificadas</p>
                </div>
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><Truck size={28} /></div>
              </Card>

              <Card className={`p-6 border-l-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow ${kpis.atrasados > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Atrasos</p>
                  <h3 className={`text-3xl font-extrabold ${kpis.atrasados > 0 ? 'text-red-600' : 'text-gray-900'}`}>{kpis.atrasados}</h3>
                  <p className="text-xs text-gray-400 mt-1">NFs fora do prazo</p>
                </div>
                <div className={`p-3 rounded-full ${kpis.atrasados > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}><AlertTriangle size={28} /></div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">Referências Únicas a Receber por Mundo</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height={300}>
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
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={kpis.grafRemetente} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 10}} />
                      <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value) => [`${value} caixas`, 'Volumes Físicos']} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <hr className="my-8 border-gray-200" />

            <div className="flex flex-col items-center">
              <button onClick={() => setMostrarLista(!mostrarLista)} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-full font-bold shadow-lg transition-all">
                {mostrarLista ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                {mostrarLista ? "Ocultar Lista Detalhada" : "Ver Lista Completa de Produtos"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="mt-6 shadow-md border-slate-200 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="font-bold text-slate-800 text-lg">Listagem de SKUs em Trânsito</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">QTDE TOTAL UNITÁRIA</span>
                  </div>
                  
                  {/* BOTÃO DE EXPORTAÇÃO AQUI */}
                  <button 
                    onClick={handleExportarCSV}
                    className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-md text-sm font-bold transition-colors"
                  >
                    <Download size={16} /> Exportar Excel / CSV
                  </button>
                </div>
                
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 text-xs uppercase sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Remetente</th>
                        <th className="px-4 py-3 font-semibold">Nota Fiscal</th>
                        <th className="px-4 py-3 font-semibold">Ref. (SKU)</th>
                        <th className="px-4 py-3 font-semibold w-1/3">Descrição</th>
                        <th className="px-4 py-3 font-semibold">Mundo</th>
                        <th className="px-4 py-3 font-semibold text-right bg-blue-50/50">Qtd. Total</th>
                        <th className="px-4 py-3 font-semibold text-center">Previsão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpis.listaRecebimento.map((item, idx) => {
                        const qtdTotalUnitaria = item.quantidade * (item.qtdePorCaixa || 1);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-600">{item.remetente || '-'}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{item.notaFiscal || '-'}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.produtoSku}</td>
                            <td className="px-4 py-3 text-slate-700">{item.descricao || 'Sem descrição'}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-medium">{item.mundo || '-'}</td>
                            <td className="px-4 py-3 font-black text-blue-700 text-right bg-blue-50/20">{qtdTotalUnitaria}</td>
                            <td className="px-4 py-3 text-center text-slate-600">
                              {item.previsaoEntrega ? new Date(item.previsaoEntrega).toLocaleDateString('pt-BR') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {kpis.listaRecebimento.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum produto em trânsito no momento.</td></tr>
                      )}
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