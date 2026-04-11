/**
 * client/src/pages/recebimento/Config.tsx
 */

import { useState } from "react";
import { Settings, Save, AlertCircle, RefreshCw, Loader2, Search } from "lucide-react";
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
  const testRoboMutation = trpc.admin.testarRobo.useMutation();

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
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar configuração.");
    }
  };

  const handleSyncNow = async () => {
    try {
      const res: any = await syncMutation.mutateAsync();
      if (res.erros && res.erros.length > 0) {
        toast.warning(`Aviso: ${res.erros[0]}`);
      } else {
        toast.success(`Sincronização concluída! ${res.novosPedidos + res.novasPrevisoes + res.chegadas} registos alterados.`);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao sincronizar.");
    }
  };

  const handleTestarRobo = async () => {
    try {
      const res = await testRoboMutation.mutateAsync();
      console.log("====== 🤖 RAIO-X DO ROBÔ ======");
      console.log(JSON.stringify(res, null, 2));
      console.log("===============================");
      
      if (res.sucesso) {
        alert(`Raio-X Concluído!\n\nO robô leu a aba "${res.aba}" com ${res.totalLinhas} linhas no total.\n\nAperta F12 e vai na aba Console para veres exatamente as colunas que ele encontrou. Copia o que está lá e envia-me!`);
      } else {
        toast.error("Erro do Robô: " + res.mensagem);
      }
    } catch (error: any) {
      toast.error("Falha ao testar: " + error.message);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-1">Recebimento Futuro</p>
        </div>

        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Settings className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Integração com Google Sheets</h2>
          </div>
          {configQuery.data?.sheetsUrl && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <strong>URL atual:</strong> <span className="break-all">{configQuery.data.sheetsUrl}</span>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">Nova URL do Google Sheets</span>
            <Input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
            />
          </label>
          <Button onClick={handleSaveConfig} disabled={configMutation.isPending} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
            {configMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={18} />}
            {configMutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </Card>

        {/* Card Atualizado com o Diagnóstico */}
        <Card className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-gray-900">Sincronização Manual & Diagnóstico</h3>
          <p className="text-gray-600 text-sm">
            Força a leitura da planilha ou usa o Raio-X para veres exatamente as palavras e as colunas que o robô está a ler da tua folha de Excel.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={handleSyncNow} disabled={syncMutation.isPending || !configQuery.data?.sheetsUrl} className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
              {syncMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw size={18} />}
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>

            <Button onClick={handleTestarRobo} disabled={testRoboMutation.isPending || !configQuery.data?.sheetsUrl} variant="outline" className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
              {testRoboMutation.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Search size={18} />}
              {testRoboMutation.isPending ? "Lendo..." : "Raio-X do Robô"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-blue-50 border-l-4 border-l-blue-500">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Como configurar o Google Sheets</h3>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Crie ou abra sua planilha no Google Sheets.</li>
                <li>Certifique-se de que as colunas estão nomeadas corretamente.</li>
                <li>Compartilhe a planilha publicamente (Leitor).</li>
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