/**
 * client/src/pages/Dashboard.tsx
 *
 * Painel principal com estatísticas de pedidos e tabela filtrável.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_COLOR } from "@/constants";
import type { OrderStatus, Pedido } from "@/types";

// =============================================================================
// TIPOS
// =============================================================================

type FilterValue = "todos" | OrderStatus;

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <Card className="p-6 shadow-sm border-gray-100">
      <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">{label}</h3>
      <p className={`text-4xl font-black mt-2 ${colorClass}`}>{value}</p>
    </Card>
  );
}

interface FilterButtonProps {
  label: string;
  value: FilterValue;
  current: FilterValue;
  onClick: (value: FilterValue) => void;
}

function FilterButton({ label, value, current, onClick }: FilterButtonProps) {
  return (
    <Button
      variant={current === value ? "default" : "outline"}
      onClick={() => onClick(value)}
      size="sm"
      className={current === value ? "bg-blue-600 hover:bg-blue-700 shadow-md text-white" : "text-gray-600"}
    >
      {label}
    </Button>
  );
}

// =============================================================================
// PÁGINA
// =============================================================================

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("todos");

  const { data: pedidos = [], isLoading } = trpc.notifications.getPending.useQuery();

  const filteredPedidos = pedidos.filter((p: Pedido) => {
    if (activeFilter === "todos") return true;
    return p.orderStatus === activeFilter;
  });

  const stats = {
    faturado: pedidos.filter((p: Pedido) => p.orderStatus === "Faturado").length,
    previsto: pedidos.filter((p: Pedido) => p.orderStatus === "Previsto").length,
    chegou: pedidos.filter((p: Pedido) => p.orderStatus === "Chegou").length,
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin w-10 h-10 text-blue-600" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Visão Global</h1>
          <p className="text-gray-600 mt-1">Acompanhamento dos pedidos de recebimento futuro</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Faturados" value={stats.faturado} colorClass={ORDER_STATUS_COLOR.Faturado} />
          <StatCard label="Previstos" value={stats.previsto} colorClass={ORDER_STATUS_COLOR.Previsto} />
          <StatCard label="Chegaram" value={stats.chegou} colorClass={ORDER_STATUS_COLOR.Chegou} />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap bg-white p-2 rounded-lg border border-gray-100 shadow-sm w-fit">
          <FilterButton label="Todos os Pedidos" value="todos" current={activeFilter} onClick={setActiveFilter} />
          <FilterButton label="Faturados" value="Faturado" current={activeFilter} onClick={setActiveFilter} />
          <FilterButton label="Previstos" value="Previsto" current={activeFilter} onClick={setActiveFilter} />
          <FilterButton label="Chegaram" value="Chegou" current={activeFilter} onClick={setActiveFilter} />
        </div>

        {/* Tabela */}
        <Card className="overflow-hidden border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">
              Pedidos Encontrados <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-sm ml-2">{filteredPedidos.length}</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  {["Referência (SKU)", "Quantidade", "Status", "Previsão", "Data de Entrega"].map((col) => (
                    <th key={col} className="px-6 py-4 font-semibold text-gray-600">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Nenhum pedido encontrado para este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredPedidos.map((pedido: Pedido) => (
                    <tr key={pedido.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-700">{pedido.produtoSku}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{pedido.quantidade} un.</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                            ORDER_STATUS_BADGE_CLASS[pedido.orderStatus]
                          }`}
                        >
                          {pedido.orderStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(pedido.previsaoEntrega)}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(pedido.dataEntrega)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}