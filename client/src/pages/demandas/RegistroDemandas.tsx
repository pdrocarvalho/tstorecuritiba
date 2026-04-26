/**
 * client/src/pages/demandas/RegistroDemandas.tsx
 */
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, AlertTriangle, TrendingUp, Save, User, Phone, PackageSearch, RefreshCw, Link as LinkIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function RegistroDemandas() {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"ALERTA" | "VENDA">("ALERTA");
  
  // 🚀 ATUALIZADO: Agora tem seu próprio link salvo no cofre (localStorage)
  const [urlPlanilha, setUrlPlanilha] = useState(() => localStorage.getItem("url_demandas") || "");

  const [form, setForm] = useState({
    consultor: "",
    cliente: "",
    contato: "",
    referencia: ""
  });

  const salvarDemanda = trpc.notifications.saveDemanda.useMutation({
    onSuccess: () => {
      toast.success(`${tipo === "ALERTA" ? "Alerta de Demanda" : "Venda Futura"} registrado com sucesso!`);
      setForm({ consultor: "", cliente: "", contato: "", referencia: "" });
      setLoading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setLoading(false);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novaUrl = e.target.value;
    setUrlPlanilha(novaUrl);
    localStorage.setItem("url_demandas", novaUrl); // Salva para não precisar colar de novo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlPlanilha) return toast.error("Cole o link da planilha de demandas primeiro.");
    if (!form.consultor || !form.cliente || !form.referencia) {
      return toast.warning("Preencha os campos obrigatórios!");
    }

    setLoading(true);
    
    const abaDestino = tipo === "ALERTA" ? "DB-ALERTA_DE_DEMANDA" : "DB-VENDA_FUTURA";
    
    salvarDemanda.mutate({
      url: urlPlanilha,
      aba: abaDestino,
      dados: [
        form.consultor.toUpperCase(),
        form.cliente.toUpperCase(),
        form.contato,
        form.referencia.trim(),
        "AGUARDANDO" 
      ]
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={32} />
            Registro de Demandas
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Cadastre produtos para que o sistema monitore as chegadas automaticamente.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-lg border-0 ring-1 ring-slate-200">
          
          {/* 🚀 NOVO CAMPO: Link da Planilha Específica */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <label className="text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2 mb-2">
              <LinkIcon size={14} /> Link da Planilha de Demandas (Google Sheets)
            </label>
            <Input 
              value={urlPlanilha} 
              onChange={handleUrlChange} 
              placeholder="Cole o link aqui (só precisará fazer isso uma vez)..." 
              className="bg-white border-blue-200 focus-visible:ring-blue-500"
            />
            <p className="text-xs text-blue-600/80 mt-2 font-medium">
              A planilha deve conter as abas <strong>DB-ALERTA_DE_DEMANDA</strong> e <strong>DB-VENDA_FUTURA</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Registro</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipo("ALERTA")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "ALERTA" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <AlertTriangle size={24} className="mb-2" />
                  <span className="font-bold">Alerta de Demanda</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipo("VENDA")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "VENDA" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <TrendingUp size={24} className="mb-2" />
                  <span className="font-bold">Venda Futura</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Consultor *</label>
                <Input name="consultor" value={form.consultor} onChange={handleChange} placeholder="Seu nome" className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Cliente *</label>
                <Input name="cliente" value={form.cliente} onChange={handleChange} placeholder="Nome do cliente" className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Phone size={14} /> Contato</label>
                <Input name="contato" value={form.contato} onChange={handleChange} placeholder="(00) 00000-0000" className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><PackageSearch size={14} /> Referência (SKU) *</label>
                <Input name="referencia" value={form.referencia} onChange={handleChange} placeholder="Ex: 123456" className="font-mono bg-slate-50" />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className={`w-full py-6 text-lg font-bold shadow-md ${tipo === "ALERTA" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" />}
              Salvar {tipo === "ALERTA" ? "Alerta" : "Venda Futura"}
            </Button>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
}