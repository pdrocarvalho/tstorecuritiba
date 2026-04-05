/**
 * client/src/pages/recebimento/KPIs.tsx
 *
 * Dashboard de KPIs de Recebimento Futuro.
 *  - Bloco A: Volume total por Fábrica (REMETENTE)
 *  - Bloco B: Diversidade de Mix por Mundo (REF. únicas por MUNDO)
 */

import { useMemo } from "react";
import { Package, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { formatNumber, calcPercent } from "@/lib/utils";
import type { Pedido, VolumeporFabrica, DiversidadePorMundo, KpiStats } from "@/types";

// =============================================================================
// HOOKS DE CÁLCULO
// =============================================================================

function useKpiData(pedidos: Pedido[]) {
  return useMemo(() => {
    const volumeMap = new Map<string, number>();
    const mundoMap = new Map<string, Set<string>>();

    for (const p of pedidos) {
      const remetente = p.remetente ?? "Desconhecido";
      const mundo = p.mundo ?? "Geral";

      volumeMap.set(remetente, (volumeMap.get(remetente) ?? 0) + p.quantidade);

      if (!mundoMap.has(mundo)) mundoMap.set(mundo, new Set());
      mundoMap.get(mundo)!.add(p.produtoSku);
    }

    const volumePorFabrica: VolumeporFabrica[] = Array.from(volumeMap.entries())
      .map(([nome, volume]) => ({ nome, volume }))
      .sort((a, b) => b.volume - a.volume);

    const diversidadePorMundo: DiversidadePorMundo[] = Array.from(mundoMap.entries())
      .map(([mundo, refs]) => ({ mundo, totalRefs: refs.size }))
      .sort((a, b) => b.totalRefs - a.totalRefs);

    const stats: KpiStats = {
      totalProdutos: pedidos.length,
      totalVolume: pedidos.reduce((sum, p) => sum + p.quantidade, 0),
      totalFabricas: volumePorFabrica.length,
      totalMundos: diversidadePorMundo.length,
    };

    return { volumePorFabrica, diversidadePorMundo, stats };
  }, [pedidos]);
}

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClass: string;
}

function StatCard({ label, value, icon: Icon, iconClass }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <Icon className={iconClass} size={32} />
      </div>
    </Card>
  );
}

interface ProgressBarProps {
  percent: number;
  colorClass: string;
}

function ProgressBar({ percent, colorClass }: ProgressBarProps) {
  return (
    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
      <div
        className={`${colorClass} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

interface VolumeCardProps {
  fabrica: VolumeporFabrica;
  totalVolume: number;
}

function VolumeCard({ fabrica, totalVolume }: VolumeCardProps) {
  const percent = calcPercent(fabrica.volume, totalVolume);
  return (
    <Card className="p-6 border-l-4 border-l-blue-600">
      <h3 className="font-semibold text-gray-900 text-lg truncate">{fabrica.nome}</h3>
      <p className="text-gray-600 text-sm mt-4">Volume Total</p>
      <p className="text-4xl font-bold text-blue-600 mt-1">
        {formatNumber(fabrica.volume)}
      </p>
      <ProgressBar percent={percent} colorClass="bg-blue-600" />
      <p className="text-xs text-gray-500 mt-2">{percent.toFixed(1)}% do total</p>
    </Card>
  );
}

interface MundoCardProps {
  mundo: DiversidadePorMundo;
  maxRefs: number;
}

function MundoCard({ mundo, maxRefs }: MundoCardProps) {
  const percent = calcPercent(mundo.totalRefs, maxRefs);
  return (
    <Card className="p-6 border-l-4 border-l-green-600">
      <h3 className="font-semibold text-gray-900 text-lg truncate">{mundo.mundo}</h3>
      <p className="text-gray-600 text-sm mt-4">Referências Únicas</p>
      <p className="text-4xl font-bold text-green-600 mt-1">{mundo.totalRefs}</p>
      <ProgressBar percent={percent} colorClass="bg-green-600" />
      <p className="text-xs text-gray-500 mt-2">Referências distintas a caminho</p>
    </Card>
  );
}

// =============================================================================
// PÁGINA
// =============================================================================

export default function RecebimentoKPIs() {
  const { data = [] } = trpc.notifications.getPending.useQuery();
  const pedidos = data as Pedido[];

  const { volumePorFabrica, diversidadePorMundo, stats } = useKpiData(pedidos);
  const maxRefs = diversidadePorMundo[0]?.totalRefs ?? 1;

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Índices / KPI's</h1>
          <p className="text-gray-600 mt-1">Dashboard de Recebimento Futuro</p>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total de Produtos"
            value={stats.totalProdutos}
            icon={Package}
            iconClass="text-blue-600"
          />
          <StatCard
            label="Volume Total"
            value={formatNumber(stats.totalVolume)}
            icon={Layers}
            iconClass="text-orange-600"
          />
          <StatCard
            label="Fábricas"
            value={stats.totalFabricas}
            icon={Package}
            iconClass="text-green-600"
          />
          <StatCard
            label="Mundos"
            value={stats.totalMundos}
            icon={Layers}
            iconClass="text-purple-600"
          />
        </div>

        {/* Bloco A: Volume por Fábrica */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Bloco A — Volume por Fábrica
          </h2>
          {volumePorFabrica.length === 0 ? (
            <p className="text-gray-500">Nenhuma fábrica com dados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {volumePorFabrica.map((fabrica) => (
                <VolumeCard
                  key={fabrica.nome}
                  fabrica={fabrica}
                  totalVolume={stats.totalVolume}
                />
              ))}
            </div>
          )}
        </section>

        {/* Bloco B: Diversidade de Mix por Mundo */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Bloco B — Diversidade de Mix por Mundo
          </h2>
          {diversidadePorMundo.length === 0 ? (
            <p className="text-gray-500">Nenhum mundo com dados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {diversidadePorMundo.map((mundo) => (
                <MundoCard key={mundo.mundo} mundo={mundo} maxRefs={maxRefs} />
              ))}
            </div>
          )}
        </section>

        {/* Resumo Executivo */}
        <Card className="p-6 bg-blue-50 border-l-4 border-l-blue-600">
          <h3 className="font-semibold text-gray-900 mb-3">Resumo Executivo</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• <strong>{stats.totalProdutos}</strong> produto(s) aguardando chegada</li>
            <li>• Volume total de <strong>{formatNumber(stats.totalVolume)}</strong> unidades</li>
            <li>• Provenientes de <strong>{stats.totalFabricas}</strong> fábrica(s)</li>
            <li>• Distribuídos em <strong>{stats.totalMundos}</strong> categoria(s) (Mundos)</li>
          </ul>
        </Card>
      </div>
    </MainLayout>
  );
}
