/**
 * client/src/pages/demandas/RegistroDemandas.tsx
 */
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, AlertTriangle, TrendingUp, Save, User, Phone, PackageSearch } from "lucide-react";

export default function RegistroDemandas() {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"ALERTA" | "VENDA">("ALERTA");
  
  const [form, setForm] = useState({
    consultor: "",
    cliente: "",
    contato: "",
    referencia: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consultor || !form.cliente || !form.referencia) {
      return toast.warning("Preencha os campos obrigatórios!");
    }

    setLoading(true);
    // Aqui vai entrar a nossa lógica de backend (salvar no Google Sheets silenciosamente)
    setTimeout(() => {
      toast.success(`${tipo === "ALERTA" ? "Alerta de Demanda" : "Venda Futura"} registrado com sucesso!`);
      setForm({ consultor: "", cliente: "", contato: "", referencia: "" });
      setLoading(false);
    }, 1500);
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-4xl mx-auto">
        
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={32} />
            Registro de Demandas
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Cadastre produtos procurados ou já vendidos para que o sistema monitore as chegadas.
          </p>
        </div>

        <Card className="p-6 md:p-8 shadow-lg border-0 ring-1 ring-slate-200">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Seletor de Tipo */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Registro</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipo("ALERTA")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "ALERTA" 
                      ? "border-red-500 bg-red-50 text-red-700 shadow-sm" 
                      : "border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50/50"
                  }`}
                >
                  <AlertTriangle size={24} className="mb-2" />
                  <span className="font-bold">Alerta de Demanda</span>
                  <span className="text-xs mt-1 opacity-80 text-center">Cliente procurou, mas não tinha no estoque.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipo("VENDA")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "VENDA" 
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" 
                      : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50/50"
                  }`}
                >
                  <TrendingUp size={24} className="mb-2" />
                  <span className="font-bold">Venda Futura</span>
                  <span className="text-xs mt-1 opacity-80 text-center">Cliente já comprou e está aguardando chegar.</span>
                </button>
              </div>
            </div>

            {/* Campos do Formulário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Consultor (Seu Nome) *
                </label>
                <Input 
                  name="consultor" value={form.consultor} onChange={handleChange} 
                  placeholder="Ex: Pedro, Ionice..." className="bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Nome do Cliente *
                </label>
                <Input 
                  name="cliente" value={form.cliente} onChange={handleChange} 
                  placeholder="Nome do cliente" className="bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Phone size={14} /> Contato do Cliente
                </label>
                <Input 
                  name="contato" value={form.contato} onChange={handleChange} 
                  placeholder="(00) 00000-0000" className="bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <PackageSearch size={14} /> SKU / Referência do Produto *
                </label>
                <Input 
                  name="referencia" value={form.referencia} onChange={handleChange} 
                  placeholder="Ex: 123456" className="bg-slate-50 font-mono"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className={`w-full py-6 text-lg font-bold shadow-md transition-all ${
                tipo === "ALERTA" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Salvando no sistema..." : (
                <>
                  <Save className="mr-2" size={20} />
                  Salvar {tipo === "ALERTA" ? "Alerta" : "Venda Futura"}
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
}