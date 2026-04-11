/**
 * client/src/pages/recebimento/Produtos.tsx
 *
 * Lista de produtos com filtros, impressão em A4 e
 * indicador de status da planilha (LED Verde).
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
// FILTROS
// =============================================================================

const INITIAL_FILTERS: ProdutosFiltros = { remetente: "", mundo: "", status: "" };

function filtraPedidos(pedidos: Pedido[], filtros: ProdutosFiltros): Pedido[] {
  return pedidos.filter((p) => {
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
// IMPRESSÃO
// =============================================================================

function printTable(tableHtml: string) {
  const printWindow = window.open("", "", "height=600,width=800");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Lista de Produtos — ESTOQUE</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; font-size: 20px; margin-bottom: 16px; }
        .data { text-align: right; font-size: 12px; color: #666; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; }
        td { border: 1px solid #ddd; padding: 6px 8px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <p class="data">Impresso em: ${new Date().toLocaleDateString("pt-BR")}</p>
      <h1>Lista de Produtos — Recebimento Futuro</h1>
      ${tableHtml}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
}

// =============================================================================
// PÁGINA
// =============================================================================

export default function RecebimentoProdutos() {
  const [filtros, setFiltros] = useState<ProdutosFiltros>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const [, setLocation] = useLocation();

  // Busca as configurações para saber o status do arquivo (O LED Verde)
  const configQuery = trpc.admin.getConfig.useQuery();
  const isOnline = !!configQuery.data?.sheetsUrl;
  const fileName = configQuery.data?.fileName || "Planilha não vinculada";

  const { data: pedidos = [] } = trpc.notifications.getPending.useQuery();
  const produtosFiltrados = filtraPedidos(pedidos as Pedido[], filtros);

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
        
        {/* Status do Arquivo (O LED Verde) */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {isOnline ? `Status Online: ${fileName}` : "Status: Offline (Vincule uma planilha)"}
          </span>
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lista de Produtos</h1>
            <p className="text-gray-600 mt-1">Recebimento Futuro</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleVincularSheets}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Upload size={18} />
              Vincular Google Sheets
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Printer size={18} />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="p-4">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className="flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
          >
            <Filter size={18} />
            Filtros
            {showFilters && <X size={16} />}
          </button>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">
                  Remetente
                </span>
                <Input
                  placeholder="Filtrar por remetente..."
                  value={filtros.remetente}
                  onChange={(e) => handleFiltroChange("remetente", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">
                  Mundo (Categoria)
                </span>
                <Input
                  placeholder="Filtrar por mundo..."
                  value={filtros.mundo}
                  onChange={(e) => handleFiltroChange("mundo", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">
                  Status
                </span>
                <select
                  value={filtros.status}
                  onChange={(e) => handleFiltroChange("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Todos</option>
                  <option value="Faturado">Faturado</option>
                  <option value="Previsto">Previsto</option>
                  <option value="Chegou">Chegou</option>
                </select>
              </label>
            </div>
          )}
        </Card>

        {/* Tabela */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  {[
                    "REMETENTE",
                    "NOTA FISCAL",
                    "REF.",
                    "DESCRIÇÃO",
                    "MUNDO",
                    "QTDE.",
                    "PREVISÃO",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left font-semibold text-gray-900"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  produtosFiltrados.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-b hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-4 py-3">{produto.remetente ?? "—"}</td>
                      <td className="px-4 py-3">{produto.notaFiscal ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">{produto.produtoSku}</td>
                      <td className="px-4 py-3">{produto.descricao}</td>
                      <td className="px-4 py-3">{produto.mundo ?? "—"}</td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {produto.quantidade}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(produto.previsaoEntrega)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
            Total: <strong>{produtosFiltrados.length}</strong> produto(s)
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}