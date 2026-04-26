/**
 * client/src/pages/configuracoes/VincularArquivos.tsx
 */
import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Link as LinkIcon, Database, Save, Trash2 } from "lucide-react";

export default function VincularArquivos() {
  const [links, setLinks] = useState({
    recebimento: "",
    demandas: "",
    avarias: ""
  });

  // Carrega os links salvos ao abrir a tela
  useEffect(() => {
    setLinks({
      recebimento: localStorage.getItem("url_recebimento") || "",
      demandas: localStorage.getItem("url_demandas") || "",
      avarias: localStorage.getItem("url_avarias") || ""
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLinks({ ...links, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    localStorage.setItem("url_recebimento", links.recebimento);
    localStorage.setItem("url_demandas", links.demandas);
    localStorage.setItem("url_avarias", links.avarias);
    toast.success("Links vinculados com sucesso! O sistema já está conectado.");
  };

  const handleClear = (tipo: keyof typeof links) => {
    const novosLinks = { ...links, [tipo]: "" };
    setLinks(novosLinks);
    localStorage.setItem(`url_${tipo}`, "");
    toast.info(`Vínculo de ${tipo} removido.`);
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings className="text-slate-700" size={32} />
            Configurações do Sistema
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Gerencie as conexões do sistema com o seu Banco de Dados (Google Sheets).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          
          {/* BANCO DE DADOS PRINCIPAL */}
          <Card className="p-6 md:p-8 shadow-sm border-2 border-blue-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Recebimento Futuro (Base Principal)</h2>
                <p className="text-sm text-slate-500">Planilha onde constam os produtos faturados, com previsão e que chegaram.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  name="recebimento"
                  value={links.recebimento}
                  onChange={handleChange}
                  placeholder="Cole o link da planilha de Recebimento Futuro aqui..."
                  className="pl-10 bg-slate-50"
                />
              </div>
              <Button variant="outline" onClick={() => handleClear('recebimento')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>

          {/* DEMANDAS E ALERTAS */}
          <Card className="p-6 md:p-8 shadow-sm border-2 border-emerald-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Alertas e Demandas</h2>
                <p className="text-sm text-slate-500">Planilha contendo as abas de Alerta de Demanda e Venda Futura.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  name="demandas"
                  value={links.demandas}
                  onChange={handleChange}
                  placeholder="Cole o link da planilha de Demandas aqui..."
                  className="pl-10 bg-slate-50"
                />
              </div>
              <Button variant="outline" onClick={() => handleClear('demandas')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>

          {/* AVARIAS */}
          <Card className="p-6 md:p-8 shadow-sm border-2 border-orange-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">Gestão de Avarias</h2>
                <p className="text-sm text-slate-500">Planilha contendo o banco de dados de produtos avariados.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  name="avarias"
                  value={links.avarias}
                  onChange={handleChange}
                  placeholder="Cole o link da planilha de Avarias aqui..."
                  className="pl-10 bg-slate-50"
                />
              </div>
              <Button variant="outline" onClick={() => handleClear('avarias')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>

        </div>

        {/* BOTÃO SALVAR GLOBAL */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg font-bold shadow-lg">
            <Save className="mr-2" size={20} />
            Salvar Todas as Configurações
          </Button>
        </div>

      </div>
    </MainLayout>
  );
}