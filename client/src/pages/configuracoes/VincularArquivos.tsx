/**
 * client/src/pages/configuracoes/VincularArquivos.tsx
 */
import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Link as LinkIcon, Database, Save, Trash2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

const SHEETS_REGEX = /https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;

const validarUrl = (url: string): boolean => {
  if (!url) return true; // vazio é permitido
  return SHEETS_REGEX.test(url);
};

export default function VincularArquivos() {
  const [links, setLinks] = useState({
    recebimento: "",
    demandas: "",
    avarias: ""
  });

  const [erros, setErros] = useState({
    recebimento: false,
    demandas: false,
    avarias: false
  });

  const syncMutation = trpc.sync.runFullSync.useMutation({
    onSuccess: (data) => {
      toast.success("Sincronização concluída com sucesso!");
      if (data.logs && data.logs.length > 0) {
        data.logs.forEach(log => toast.success(log));
      }
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    }
  });

  useEffect(() => {
    setLinks({
      recebimento: localStorage.getItem("url_recebimento") || "",
      demandas: localStorage.getItem("url_demandas") || "",
      avarias: localStorage.getItem("url_avarias") || ""
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLinks({ ...links, [name]: value });
    setErros({ ...erros, [name]: value ? !validarUrl(value) : false });
  };

  const handleSave = () => {
    const novosErros = {
      recebimento: links.recebimento ? !validarUrl(links.recebimento) : false,
      demandas: links.demandas ? !validarUrl(links.demandas) : false,
      avarias: links.avarias ? !validarUrl(links.avarias) : false,
    };

    setErros(novosErros);

    if (Object.values(novosErros).some(Boolean)) {
      toast.error("Corrija as URLs inválidas antes de salvar.");
      return;
    }

    localStorage.setItem("url_recebimento", links.recebimento);
    localStorage.setItem("url_demandas", links.demandas);
    localStorage.setItem("url_avarias", links.avarias);
    toast.success("Links vinculados com sucesso! O sistema já está conectado.");
  };

  const handleClear = (tipo: keyof typeof links) => {
    const novosLinks = { ...links, [tipo]: "" };
    setLinks(novosLinks);
    setErros({ ...erros, [tipo]: false });
    localStorage.setItem(`url_${tipo}`, "");
    toast.info(`Vínculo de ${tipo} removido.`);
  };

  const handleSync = () => {
    if (!links.recebimento && !links.demandas && !links.avarias) {
      toast.error("Nenhuma planilha vinculada para sincronizar.");
      return;
    }
    toast.info("Iniciando sincronização... Isso pode demorar alguns segundos.", { duration: 5000 });
    syncMutation.mutate({
      recebimentos: links.recebimento || undefined,
      demandas: links.demandas || undefined,
      avarias: links.avarias || undefined,
    });
  };

  const getInputIcon = (campo: keyof typeof links) => {
    if (!links[campo]) return <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />;
    if (erros[campo]) return <XCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />;
    return <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />;
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Settings className="text-brand-secondary" size={32} />
            Configurações do Sistema
          </h1>
          <p className="text-white/50 font-medium mt-1">
            Gerencie as conexões do sistema com o seu Banco de Dados (Google Sheets).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">

          {/* BANCO DE DADOS PRINCIPAL */}
          <Card className="p-6 md:p-8 shadow-sm bg-glass border-glass-border backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500/10 p-3 rounded-lg text-blue-400">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Recebimento Futuro (Base Principal)</h2>
                <p className="text-sm text-white/50">Planilha onde constam os produtos faturados, com previsão e que chegaram.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                {getInputIcon('recebimento')}
                <Input
                  name="recebimento"
                  value={links.recebimento}
                  onChange={handleChange}
                  placeholder="Cole o link da planilha de Recebimento Futuro aqui..."
                  className={`pl-10 bg-black/20 border-white/10 text-white placeholder:text-white/30 ${erros.recebimento ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
                {erros.recebimento && <p className="text-xs text-red-500 mt-1">URL inválida. Use o link completo do Google Sheets.</p>}
              </div>
              <Button variant="outline" onClick={() => handleClear('recebimento')} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-white/10 bg-transparent">
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>

          {/* DEMANDAS E ALERTAS */}
          <Card className="p-6 md:p-8 shadow-sm bg-glass border-glass-border backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Alertas e Demandas</h2>
                <p className="text-sm text-white/50">Planilha contendo as abas de Alerta de Demanda e Venda Futura.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                {getInputIcon('demandas')}
                <Input
                  name="demandas"
                  value={links.demandas}
                  onChange={handleChange}
                  placeholder="Cole o link da planilha de Demandas aqui..."
                  className={`pl-10 bg-black/20 border-white/10 text-white placeholder:text-white/30 ${erros.demandas ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
                {erros.demandas && <p className="text-xs text-red-500 mt-1">URL inválida. Use o link completo do Google Sheets.</p>}
              </div>
              <Button variant="outline" onClick={() => handleClear('demandas')} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-white/10 bg-transparent">
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>

          {/* AVARIAS */}
          <Card className="p-6 md:p-8 shadow-sm bg-glass border-glass-border backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-500/10 p-3 rounded-lg text-orange-400">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Gestão de Avarias</h2>
                <p className="text-sm text-white/50">Planilha contendo o banco de dados de produtos avariados.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                {getInputIcon('avarias')}
                <Input
                  name="avarias"
                  value={links.avarias}
                  onChange={handleChange}
                  placeholder="Cole o link da planilha de Avarias aqui..."
                  className={`pl-10 bg-black/20 border-white/10 text-white placeholder:text-white/30 ${erros.avarias ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
                {erros.avarias && <p className="text-xs text-red-500 mt-1">URL inválida. Use o link completo do Google Sheets.</p>}
              </div>
              <Button variant="outline" onClick={() => handleClear('avarias')} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-white/10 bg-transparent">
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>

        </div>

        {/* BOTÃO SALVAR GLOBAL */}
        <div className="flex justify-end pt-4 gap-4">
          <Button 
            onClick={handleSync} 
            disabled={syncMutation.isPending}
            variant="outline"
            className="bg-brand-primary/10 border-brand-primary/20 hover:bg-brand-primary/20 text-brand-primary px-8 py-6 text-lg font-bold shadow-lg"
          >
            <RefreshCw className={`mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} size={20} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Banco de Dados"}
          </Button>

          <Button onClick={handleSave} className="bg-glass border border-glass-border hover:bg-glass-hover text-white px-8 py-6 text-lg font-bold shadow-lg">
            <Save className="mr-2" size={20} />
            Salvar Todas as Configurações
          </Button>
        </div>

      </div>
    </MainLayout>
  );
}