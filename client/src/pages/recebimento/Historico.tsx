/**
 * client/src/pages/recebimento/Historico.tsx
 *
 * Página: Histórico de Entregas
 * Exibe apenas produtos que JÁ POSSUEM "Data de Entrega".
 */

import { useRef, useState } from "react";
import { Printer, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import type { Pedido, ProdutosFiltros } from "@/types";

const INITIAL_FILTERS: ProdutosFiltros = { remetente: "", mundo: "", status: "" };

function filtraHistorico(pedidos: Pedido[], filtros: ProdutosFiltros): Pedido[] {
  return pedidos.filter((p) => {
    // REGRA PRINCIPAL: Se NÃO tem data de entrega, não aparece no histórico!
    if (!p.dataEntrega) return false;

    const matchRemetente = !filtros.remetente || p.remetente?.toLowerCase().includes(filtros.remetente.toLowerCase());
    const matchMundo = !filtros.mundo || p.mundo?.toLowerCase().includes(filtros.mundo.toLowerCase());
    
    return matchRemetente && matchMundo;
  });
}

function printTable(tableHtml: string) {
  const printWindow = window.open("", "", "height=600,width=800");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Histórico de Entregas</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; font-size: 20px; margin-bottom: 16px; }
        .data { text-align: right; font-size: 12px; color: #666; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; font-size: 10px; }
        td { border: 1px solid #ddd; padding: 6px 8px; font-size: 10px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <p class="data">Relatório gerado em: ${new Date().toLocaleDateString("pt-BR")}</p>
      <h1>Histórico de Entregas (Produtos já recebidos)</h1>
      ${tableHtml}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

export default function RecebimentoHistorico() {
  const [filtros, setFiltros] = useState<ProdutosFiltros>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // Busca todos os pedidos e aplica o filtro de "Histórico" localmente
  const { data: todosPedidos = [] } = trpc.notifications.getPending.useQuery();
  const historico = filtraHistorico(todosPedidos as Pedido[], filtros);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Histórico de Entregas</h1>
            <p className="text-gray-600 mt-1">Produtos que já deram entrada na loja</p>
          </div>
          <Button onClick={() => tableRef.current && printTable(tableRef.current.outerHTML)} variant="outline" className="flex items-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <Printer size={18} />
            Imprimir Relatório
          </Button>
        </div>

        <Card className="p-4">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-emerald-600 font-medium hover:text-emerald-700">
            <Filter size={18} /> Filtrar Histórico {showFilters && <X size={16} />}
          </button>
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">Remetente</span>
                <Input placeholder="Filtrar por remetente..." value={filtros.remetente} onChange={(e) => setFiltros({...filtros, remetente: e.target.value})} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">Mundo</span>
                <Input placeholder="Filtrar por mundo..." value={filtros.mundo} onChange={(e) => setFiltros({...filtros, mundo: e.target.value})} />
              </label>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm text-left">
              <thead className="bg-emerald-50 border-b border-emerald-100">
                <tr>
                  {["REMETENTE", "NOTA FISCAL", "REF.", "DESCRIÇÃO", "MUNDO", "QTDE. TOTAL", "DATA DE ENTREGA"].map((col) => (
                    <th key={col} className="px-4 py-4 font-bold text-emerald-900 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">Nenhum produto entregue encontrado.</td></tr>
                ) : (
                  historico.map((produto) => (
                    <tr key={produto.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{produto.remetente ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{produto.notaFiscal ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-emerald-600">{produto.produtoSku}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{produto.descricao}</td>
                      <td className="px-4 py-3 text-gray-600">{produto.mundo ?? "—"}</td>
                      <td className="px-4 py-3 text-center font-bold">{produto.quantidade * (produto.qtdePorCaixa || 1)}</td>
                      <td className="px-4 py-3 text-emerald-600 font-bold">{formatDate(produto.dataEntrega)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-emerald-50/50 border-t border-emerald-100 text-xs font-semibold text-emerald-700">
            TOTAL DE ITENS RECEBIDOS: {historico.length}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}