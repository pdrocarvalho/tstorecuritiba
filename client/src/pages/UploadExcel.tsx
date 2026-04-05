/**
 * client/src/pages/UploadExcel.tsx
 *
 * Página de sincronização de dados via Google Sheets.
 * Exibe o resultado da última sincronização ao concluir.
 */

import { Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { SyncResult } from "@/types";

// =============================================================================
// COMPONENTE DE RESULTADO
// =============================================================================

function SyncResultCard({ result }: { result: SyncResult }) {
  const items = [
    { label: "Novos Pedidos", value: result.novosPedidos },
    { label: "Novas Previsões", value: result.novasPrevisoes },
    { label: "Chegadas", value: result.chegadas },
  ];

  return (
    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="text-green-600 w-5 h-5" />
        <h3 className="font-bold text-green-900">Sincronização Concluída</h3>
      </div>
      <ul className="space-y-1">
        {items.map(({ label, value }) => (
          <li key={label} className="text-sm text-green-800">
            {label}: <strong>{value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// PÁGINA
// =============================================================================

export default function UploadExcel() {
  const syncMutation = trpc.admin.syncNow.useMutation();

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast.success("Sincronização concluída com sucesso!");
    } catch {
      toast.error(
        "Erro ao sincronizar. Verifique se o Google Sheets está configurado."
      );
    }
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sincronizar Dados</h1>
          <p className="text-gray-600 mt-1">
            Atualiza o banco de dados com os dados mais recentes do Google Sheets.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            Sincronizar via Google Sheets
          </h2>
          <p className="text-gray-600 text-sm">
            Clique no botão abaixo para ler os dados da planilha configurada e
            atualizar o banco de dados. Pedidos que mudaram de fase receberão uma
            notificação pendente.
          </p>

          <Button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sincronizar Agora
              </>
            )}
          </Button>

          {syncMutation.data && (
            <SyncResultCard result={syncMutation.data as SyncResult} />
          )}
        </Card>

        <Card className="p-6 bg-blue-50 border-l-4 border-l-blue-500">
          <h3 className="font-semibold text-gray-900 mb-2">Como funciona?</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>O sistema lê os dados da planilha configurada em Configurações.</li>
            <li>Compara cada produto com o banco de dados atual.</li>
            <li>Insere novos pedidos ou atualiza os existentes.</li>
            <li>Pedidos que mudaram de fase ficam com notificação pendente.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
