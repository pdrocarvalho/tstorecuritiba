/**
 * client/src/pages/recebimento/Config.tsx
 *
 * Configuração da integração com Google Sheets e sincronização manual.
 */

import { useState } from "react";
import { Settings, Save, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const REQUIRED_COLUMNS = [
  "REMETENTE",
  "NOTA FISCAL",
  "REF. (Referência/SKU)",
  "DESCRIÇÃO",
  "MUNDO",
  "QTDE. (Quantidade)",
  "PREVISÃO DE ENTREGA",
  "DATA DE ENTREGA",
];

export default function RecebimentoConfig() {
  const [sheetsUrl, setSheetsUrl] = useState("");

  const configQuery = trpc.admin.getConfig.useQuery();
  const configMutation = trpc.admin.configSheets.useMutation();
  const syncMutation = trpc.admin.syncNow.useMutation();

  const handleSaveConfig = async () => {
    if (!sheetsUrl.trim()) {
      toast.error("Insira a URL do Google Sheets antes de salvar.");
      return;
    }

    try {
      await configMutation.mutateAsync({ sheetsUrl: sheetsUrl.trim() });
      toast.success("Configuração salva com sucesso!");
      setSheetsUrl("");
      configQuery.refetch();
    } catch {
      toast.error("Erro ao salvar configuração. Tente novamente.");
    }
  };

  const handleSyncNow = async () => {
    try {
      await syncMutation.mutateAsync();
      toast.success("Sincronização concluída!");
    } catch {
      toast.error("Erro ao sincronizar. Verifique a configuração do Sheets.");
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-1">Recebimento Futuro</p>
        </div>

        {/* Card: Google Sheets */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Settings className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">
              Integração com Google Sheets
            </h2>
          </div>

          {/* URL atual */}
          {configQuery.data?.sheetsUrl && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <strong>URL atual:</strong>{" "}
              <span className="break-all">{configQuery.data.sheetsUrl}</span>
            </div>
          )}

          {/* Campo de URL */}
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">
              Nova URL do Google Sheets
            </span>
            <Input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              A planilha deve estar compartilhada publicamente (leitura).
            </p>
          </label>

          <Button
            onClick={handleSaveConfig}
            disabled={configMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            {configMutation.isPending ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <Save size={18} />
            )}
            {configMutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </Card>

        {/* Card: Sincronização manual */}
        <Card className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-gray-900">Sincronização Manual</h3>
          <p className="text-gray-600 text-sm">
            Força a leitura da planilha configurada e atualiza o banco de dados
            imediatamente.
          </p>
          <Button
            onClick={handleSyncNow}
            disabled={syncMutation.isPending || !configQuery.data?.sheetsUrl}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            {syncMutation.isPending ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <RefreshCw size={18} />
            )}
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Agora"}
          </Button>
          {!configQuery.data?.sheetsUrl && (
            <p className="text-xs text-amber-600">
              Configure uma URL do Google Sheets acima para habilitar a sincronização.
            </p>
          )}
        </Card>

        {/* Card: Instruções */}
        <Card className="p-6 bg-blue-50 border-l-4 border-l-blue-500">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                Como configurar o Google Sheets
              </h3>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Crie ou abra sua planilha no Google Sheets.</li>
                <li>
                  Certifique-se de que as colunas estão nomeadas corretamente:
                  <ul className="mt-2 ml-4 space-y-0.5 list-disc list-inside text-gray-600">
                    {REQUIRED_COLUMNS.map((col) => (
                      <li key={col}>{col}</li>
                    ))}
                  </ul>
                </li>
                <li>
                  Compartilhe a planilha publicamente:{" "}
                  <em>Arquivo → Compartilhar → Qualquer pessoa com o link (Leitor)</em>.
                </li>
                <li>Copie a URL completa e cole no campo acima.</li>
                <li>Clique em Salvar e depois em Sincronizar Agora.</li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
