/**
 * client/src/pages/demandas/RegistroDemandas.tsx
 */
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, AlertTriangle, TrendingUp, Save, User, Phone, PackageSearch, RefreshCw, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function RegistroDemandas() {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"ALERTA" | "VENDA">("ALERTA");
  
  const [urlPlanilha] = useState(() => localStorage.getItem("url_demandas") || "");

  const [form, setForm] = useState({
    consultor: "",
    cliente: "",
    contato: "",
  });

  // Array de Referências para o consultor adicionar quantas quiser
  const [referencias, setReferencias] = useState<string[]>([""]);

  // TRPC - Retiramos o onSuccess daqui, pois faremos loop no handleSubmit
  const salvarDemanda = trpc.notifications.saveDemanda.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🚀 Máscara Inteligente para o WhatsApp: (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não for número
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 9) v = `${v.slice(0, 10)}-${v.slice(10)}`;
    setForm({ ...form, contato: v });
  };

  // Funções para lidar com Múltiplas Referências
  const handleAddRef = () => setReferencias([...referencias, ""]);
  const handleRemoveRef = (index: number) => {
    if (referencias.length > 1) {
      setReferencias(referencias.filter((_, i) => i !== index));
    }
  };
  const handleRefChange = (index: number, value: string) => {
    const newRefs = [...referencias];
    newRefs[index] = value.toUpperCase();
    setReferencias(newRefs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlPlanilha) return toast.error("Vá em Configurações e vincule a planilha de Demandas primeiro.");
    
    const refsValidas = referencias.filter(r => r.trim() !== "");
    if (!form.consultor || !form.cliente || refsValidas.length === 0) {
      return toast.warning("Preencha os campos obrigatórios e adicione pelo menos uma referência!");
    }

    setLoading(true);
    const abaDestino = tipo === "ALERTA" ? "DB-ALERTA_DE_DEMANDA" : "DB-VENDA_FUTURA";
    const dataDeHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    try {
      // Faz um Loop e insere cada SKU em uma linha diferente do Sheets mantendo os dados do cliente
      for (const ref of refsValidas) {
        await salvarDemanda.mutateAsync({
          url: urlPlanilha,
          aba: abaDestino,
          dados: [
            dataDeHoje,                    // Coluna A 
            form.consultor.toUpperCase(),  // Coluna B
            form.cliente.toUpperCase(),    // Coluna C
            form.contato,                  // Coluna D (Com a Máscara)
            ref.trim(),                    // Coluna E (Referência Dinâmica)
            "AGUARDANDO",                  // Coluna F 
            ""                             // Coluna G (Carimbo)
          ]
        });
      }
      toast.success(`${tipo === "ALERTA" ? "Alerta(s)" : "Venda(s)"} registrado(s) com sucesso!`);
      setForm({ consultor: "", cliente: "", contato: "" });
      setReferencias([""]);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
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

        {!urlPlanilha && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertTriangle size={20} />
              <p className="text-sm font-bold">A fonte de dados de Demandas não foi configurada.</p>
            </div>
            <Link href="/configuracoes">
              <button className="bg-amber-600 text-white hover:bg-amber-700 px-6 py-2 rounded-lg font-bold transition-colors">
                Ir para Configurações
              </button>
            </Link>
          </div>
        )}

        <Card className="p-6 md:p-8 shadow-lg border-0 ring-1 ring-slate-200">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Registro</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipo("ALERTA")}
                  disabled={!urlPlanilha}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "ALERTA" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  } ${!urlPlanilha ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <AlertTriangle size={24} className="mb-2" />
                  <span className="font-bold">Alerta de Demanda</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipo("VENDA")}
                  disabled={!urlPlanilha}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "VENDA" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  } ${!urlPlanilha ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <TrendingUp size={24} className="mb-2" />
                  <span className="font-bold">Venda Futura</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Consultor *</label>
                <Input name="consultor" value={form.consultor} onChange={handleChange} placeholder="Seu nome" className="bg-slate-50 uppercase" disabled={!urlPlanilha} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Cliente *</label>
                <Input name="cliente" value={form.cliente} onChange={handleChange} placeholder="Nome do cliente" className="bg-slate-50 uppercase" disabled={!urlPlanilha} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Phone size={14} /> Contato (WhatsApp)</label>
                <Input name="contato" value={form.contato} onChange={handlePhoneChange} placeholder="(00) 00000-0000" className="bg-slate-50" disabled={!urlPlanilha} />
              </div>
            </div>

            {/* SESSÃO MULTI-REFERÊNCIAS */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <PackageSearch size={14} /> Referências (SKU) *
                </label>
                <button type="button" onClick={handleAddRef} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 uppercase">
                  <Plus size={14} /> Adicionar Produto
                </button>
              </div>
              
              <div className="space-y-3">
                {referencias.map((ref, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Input 
                      value={ref} 
                      onChange={(e) => handleRefChange(index, e.target.value)} 
                      placeholder="EX: 123456" 
                      className="font-mono bg-white uppercase" 
                      disabled={!urlPlanilha} 
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveRef(index)}
                      disabled={referencias.length === 1}
                      className={`p-2 rounded-lg transition-colors ${referencias.length === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50 hover:text-red-700'}`}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading || !urlPlanilha}
              className={`w-full py-6 text-lg font-bold shadow-md ${!urlPlanilha ? 'bg-slate-300' : tipo === "ALERTA" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
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