/**
 * client/src/pages/recebimento/Produtos.tsx
 */

import { useState, useMemo } from "react";
import { Link2, RefreshCw, X, Package, Truck, AlertTriangle, ChevronDown, ChevronUp, TableProperties, FileText, Printer } from "lucide-react";
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

  // 🚀 A NOVA FUNÇÃO DE IMPRESSÃO REAL (ESTILO GOOGLE SHEETS)
  const gerarRelatorioImpressao = () => {
    if (kpis.listaRecebimento.length === 0) {
      return toast.warning("Não há dados para imprimir.");
    }

    // Criamos uma nova janela invisível para o navegador
    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) return toast.error("Por favor, habilite popups para imprimir o relatório.");

    // Construímos o HTML puro do relatório
    const htmlRelatorio = `
      <html>
        <head>
          <title>Relatório de Recebimento Futuro - T Store</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; color: #333; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
            .header p { margin: 0; font-size: 12px; color: #666; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
            th { background-color: #f2f2f2; border: 1px solid #ccc; padding: 8px; font-size: 10px; text-transform: uppercase; text-align: left; }
            td { border: 1px solid #ccc; padding: 6px 8px; font-size: 10px; word-wrap: break-word; }
            
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            
            @page { size: A4 portrait; margin: 1cm; }
            tr { page-break-inside: avoid; }
            thead { display: table-header-group; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Relatório: Recebimento Futuro</h1>
              <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            <div class="text-right">
              <p>Total de Itens: <b>${kpis.listaRecebimento.length}</b></p>
              <p>Volumes Físicos: <b>${kpis.totalVolumesFisicos}</b></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">Remetente</th>
                <th style="width: 12%">Nota Fiscal</th>
                <th style="width: 12%">Ref. (SKU)</th>
                <th style="width: 32%">Descrição</th>
                <th style="width: 10%">Mundo</th>
                <th style="width: 10%" class="text-center">Previsão</th>
                <th style="width: 9%" class="text-right">Qtd. Unid</th>
              </tr>
            </thead>
            <tbody>
              ${kpis.listaRecebimento.map(item => `
                <tr>
                  <td>${item.remetente || '-'}</td>
                  <td>${item.notaFiscal || '-'}</td>
                  <td class="font-bold">${item.produtoSku}</td>
                  <td>${item.descricao || '-'}</td>
                  <td>${item.mundo || '-'}</td>
                  <td class="text-center">${item.previsaoEntrega ? new Date(item.previsaoEntrega).toLocaleDateString('pt-BR') : '-'}</td>
                  <td class="text-right font-bold">${item.quantidade * (item.qtdePorCaixa || 1)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px; font-size: 8px; color: #999; text-align: center;">
            T Store Admin - Sistema de Gestão Logística
          </div>
        </body>
      </html>
    `;

    // Injetamos o HTML na nova janela e disparamos a impressão
    janelaImpressao.document.write(htmlRelatorio);
    janelaImpressao.document.close();
    
    // Pequeno delay para garantir que o CSS/Fontes carreguem antes da caixa de impressão
    setTimeout(() => {
      janelaImpressao.print();
      janelaImpressao.close();
    }, 500);
  };

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Por favor, insira o link da planilha.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error(`Falha no acesso: ${result.error?.message}`);
        setIsVinculado(false);
      } else {
        toast.success("Dados carregados!");
        setIsVinculado(true);
      }
    } catch (error) {
      toast.error("Erro inesperado.");
      setIsVinculado(false);
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleAtualizar = async () => {
    setIsSincronizando(true);
    await refetch();
    toast.success("Tabela atualizada!");
    setIsSincronizando(false);
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    setMostrarLista(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12">
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recebimento Futuro</h1>
            <p className="text-gray-600 mt-1">Gestão inteligente e sob demanda das mercadorias em trânsito</p>
          </div>
          
          {/* BOTÕES DE AÇÃO RÁPIDA (Só aparecem se vinculado) */}
          {isVinculado && (
            <div className="flex gap-2">
              <button 
                onClick={gerarRelatorioImpressao}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95"
              >
                <Printer size={18} /> Imprimir Relatório
              </button>
              <button 
                onClick={gerarRelatorioImpressao}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all active:scale-95"
              >
                <FileText size={18} /> Gerar PDF
              </button>
            </div>
          )}
        </div>

        {/* BARRA DE VINCULAÇÃO */}
        <Card className="p-4 border border-blue-100 bg-blue-50/50 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1 block">Link do Google Sheets</span>
            <Input 
              placeholder="Cole o link da planilha..." 
              value={urlPlanilha} 
              onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado}
              className="bg-white"
            />
          </div>
          <div className="flex items-end gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium">
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />} Vincular
              </button>
            ) : (
              <>
                <button onClick={handleAtualizar} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-md font-medium">
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
                </button>
                <button onClick={handleCancelar} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-6 py-2.5 rounded-md font-medium">
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
          </div>
        )}

        {isVinculado && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPIS VISUAIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Total a Receber</p>
                  <h3 className="text-3xl font-extrabold text-gray-900">{kpis.totalVolumesFisicos}</h3>
                </div>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Package size={28} /></div>
              </Card>
              <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Notas em Trânsito</p>
                  <h3 className="text-3xl font-extrabold text-gray-900">{kpis.notasEmTransito}</h3>
                </div>
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><Truck size={28} /></div>
              </Card>
              <Card className={`p-6 border-l-4 shadow-sm flex items-center justify-between ${kpis.atrasados > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase">Atrasos</p>
                  <h3 className="text-3xl font-extrabold text-red-600">{kpis.atrasados}</h3>
                </div>
                <div className="p-3 bg-red-100 text-red-600 rounded-full"><AlertTriangle size={28} /></div>
              </Card>
            </div>

            {/* GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">SKUs por Mundo</h3>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={kpis.grafSkusMundo} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {kpis.grafSkusMundo.map((_, index) => <Cell key={index} fill={CORES_MUNDO[index % CORES_MUNDO.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">Volume por Remetente</h3>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={kpis.grafRemetente} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="flex flex-col items-center">
              <button 
                onClick={() => setMostrarLista(!mostrarLista)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-8 py-3 rounded-full font-bold shadow-sm transition-all"
              >
                {mostrarLista ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                {mostrarLista ? "Ocultar Lista no App" : "Ver Lista Completa no App"}
              </button>
            </div>

            {mostrarLista && (
              <Card className="mt-6 shadow-md border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-4 py-3 border-b">Remetente</th>
                        <th className="px-4 py-3 border-b">Nota Fiscal</th>
                        <th className="px-4 py-3 border-b">Ref</th>
                        <th className="px-4 py-3 border-b">Descrição</th>
                        <th className="px-4 py-3 border-b text-right">Qtd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
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