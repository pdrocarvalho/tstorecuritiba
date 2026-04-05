/**
 * client/src/pages/Dashboard.tsx
 *
 * Painel principal com estatísticas de pedidos e tabela filtrável.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
    <Card className="p-6">
      <h3 className="text-gray-600 text-sm font-medium">{label}</h3>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Dashboard de Pedidos</h1>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Faturados" value={stats.faturado} colorClass={ORDER_STATUS_COLOR.Faturado} />
          <StatCard label="Previstos" value={stats.previsto} colorClass={ORDER_STATUS_COLOR.Previsto} />
          <StatCard label="Chegaram" value={stats.chegou} colorClass={ORDER_STATUS_COLOR.Chegou} />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          <FilterButton label="Todos" value="todos" current={activeFilter} onClick={setActiveFilter} />
          <FilterButton label="Faturados" value="Faturado" current={activeFilter} onClick={setActiveFilter} />
          <FilterButton label="Previstos" value="Previsto" current={activeFilter} onClick={setActiveFilter} />
          <FilterButton label="Chegaram" value="Chegou" current={activeFilter} onClick={setActiveFilter} />
        </div>

        {/* Tabela */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">
            Pedidos ({filteredPedidos.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["SKU", "Quantidade", "Status", "Previsão", "Entrega"].map((col) => (
                    <th key={col} className="px-4 py-2 text-left font-medium text-gray-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPedidos.map((pedido: Pedido) => (
                    <tr key={pedido.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono">{pedido.produtoSku}</td>
                      <td className="px-4 py-2">{pedido.quantidade}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            ORDER_STATUS_BADGE_CLASS[pedido.orderStatus]
                          }`}
                        >
                          {pedido.orderStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2">{formatDate(pedido.previsaoEntrega)}</td>
                      <td className="px-4 py-2">{formatDate(pedido.dataEntrega)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
