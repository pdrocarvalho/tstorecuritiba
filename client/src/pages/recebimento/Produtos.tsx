/**
 * client/src/pages/recebimento/Produtos.tsx
 *
 * Página: Lista de Recebimento Futuro
 * Filtra produtos do banco de dados que NÃO possuem "Data de Entrega".
 */

import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Printer, Upload, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { ROUTES } from "@/constants";
import type { Pedido, ProdutosFiltros } from "@/types";

// =============================================================================
// FILTROS E LÓGICA DE NEGÓCIO
// =============================================================================

const INITIAL_FILTERS: ProdutosFiltros = { remetente: "", mundo: "", status: "" };

/**
 * Filtra a lista seguindo a Regra de Ouro:
 * 1. Apenas itens sem DATA DE ENTREGA (Recebimento Futuro).
 * 2. Aplica filtros de texto (Remetente, Mundo, etc).
 */
function filtraRecebimentoFuturo(pedidos: Pedido[], filtros: ProdutosFiltros): Pedido[] {
  return pedidos.filter((p) => {
    // REGRA PRINCIPAL: Se tem data de entrega, não aparece nesta lista
    if (p.dataEntrega) return false;

    const matchRemetente =
      !filtros.remetente ||
      p.remetente?.toLowerCase().includes(filtros.remetente.toLowerCase());
    const matchMundo =
      !filtros.mundo ||
      p.mundo?.toLowerCase().includes(filtros.mundo.toLowerCase());
    const matchStatus = !filtros.status || p.orderStatus === filtros.status;
    
    return matchRemetente && matchMundo && matchStatus;
  });
}

// =============================================================================
// FUNÇÃO DE IMPRESSÃO
// =============================================================================

function printTable(tableHtml: string) {
  const printWindow = window.open("", "", "height=600,width=800");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Recebimento Futuro — T Store Curitiba</title>
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
      <h1>Lista de Recebimento Futuro</h1>
      ${tableHtml}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
}

// =============================================================================
// COMPONENTE DA PÁGINA
// =============================================================================

export default function RecebimentoProdutos() {
  const [filtros, setFiltros] = useState<ProdutosFiltros>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const [, setLocation] = useLocation();

  // LED Status
  const configQuery = trpc.admin.getConfig.useQuery();
  const isOnline = !!configQuery.data?.sheetsUrl;
  const fileName = configQuery.data?.fileName || "Planilha não vinculada";

  // Busca todos os pedidos e aplica o filtro de "Futuro" localmente
  const { data: todosPedidos = [] } = trpc.notifications.getPending.useQuery();
  const produtosFuturos = filtraRecebimentoFuturo(todosPedidos as Pedido[], filtros);

  const handleFiltroChange = (key: keyof ProdutosFiltros, value: string) => {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  };

  const handlePrint = () => {
    if (tableRef.current) printTable(tableRef.current.outerHTML);
  };

  const handleVincularSheets = () => {
    setLocation(ROUTES.recebimento.config);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        
        {/* LED de Status */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {isOnline ? `Online: ${fileName}` : "Status: Offline"}
          </span>
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recebimento Futuro</h1>
            <p className="text-gray-600 mt-1">Produtos aguardando entrada em estoque</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleVincularSheets} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Upload size={18} />
              Sincronizar Sheets
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
              <Printer size={18} />
              Imprimir A4
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <Card className="p-4">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className="flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
          >
            <Filter size={18} />
            Filtrar Lista
            {showFilters && <X size={16} />}
          </button>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">Remetente (Fábrica)</span>
                <Input
                  placeholder="Ex: Cutelaria..."
                  value={filtros.remetente}
                  onChange={(e) => handleFiltroChange("remetente", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">Mundo</span>
                <Input
                  placeholder="Ex: Cortar..."
                  value={filtros.mundo}
                  onChange={(e) => handleFiltroChange("mundo", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">Status de Notificação</span>
                <select
                  value={filtros.status}
                  onChange={(e) => handleFiltroChange("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">Todos</option>
                  <option value="Faturado">Faturado</option>
                  <option value="Previsto">Previsto</option>
                </select>
              </label>
            </div>
          )}
        </Card>

        {/* Tabela de Recebimento Futuro */}
        <Card className="overflow-hidden border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "REMETENTE",
                    "NOTA FISCAL",
                    "REF.",
                    "DESCRIÇÃO",
                    "MUNDO",
                    "QTDE. TOTAL",
                    "PREVISÃO",
                  ].map((col) => (
                    <th key={col} className="px-4 py-4 font-bold text-gray-700 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {produtosFuturos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">
                      Nenhum produto em recebimento futuro encontrado.
                    </td>
                  </tr>
                ) : (
                  produtosFuturos.map((produto) => (
                    <tr key={produto.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{produto.remetente ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{produto.notaFiscal ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-blue-600">{produto.produtoSku}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{produto.descricao}</td>
                      <td className="px-4 py-3 text-gray-600">{produto.mundo ?? "—"}</td>
                      <td className="px-4 py-3 text-center font-bold">{produto.quantidade}</td>
                      <td className="px-4 py-3 text-orange-600 font-semibold">
                        {formatDate(produto.previsaoEntrega)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs font-semibold text-gray-500">
            TOTAL DE ITENS PENDENTES: {produtosFuturos.length}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}