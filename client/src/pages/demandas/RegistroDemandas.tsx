/**
 * client/src/pages/demandas/RegistroDemandas.tsx
 */
import { useState, useRef } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClipboardList, AlertTriangle, TrendingUp, Save, User, Phone, PackageSearch, RefreshCw, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useDemandas } from "@/_core/hooks/useDemandas";

export default function RegistroDemandas() {
  const [tipo, setTipo] = useState<"ALERTA" | "VENDA">("ALERTA");
  const [urlPlanilha] = useState(() => localStorage.getItem("url_demandas") || "");
  const [form, setForm] = useState({ consultor: "", cliente: "", contato: "" });
  const [referencias, setReferencias] = useState<{ref: string, qtd: number}[]>([{ref: "", qtd: 1}]);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);

  // Ref para evitar duplo envio em cliques rápidos
  const enviando = useRef(false);

  const { saveDemanda, isSaving } = useDemandas(urlPlanilha);

  // isSubmitting combina o isPending do tRPC com o ref de controle
  const isSubmitting = isSaving || enviando.current;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 9) v = `${v.slice(0, 10)}-${v.slice(10)}`;
    setForm({ ...form, contato: v });
  };

  const handleAddRef = () => setReferencias([...referencias, {ref: "", qtd: 1}]);
  const handleRemoveRef = (index: number) => {
    if (referencias.length > 1) setReferencias(referencias.filter((_, i) => i !== index));
  };
  const handleRefChange = (index: number, value: string) => {
    const newRefs = [...referencias];
    newRefs[index].ref = value.toUpperCase();
    setReferencias(newRefs);
  };
  const handleQtdChange = (index: number, value: string) => {
    const newRefs = [...referencias];
    newRefs[index].qtd = parseInt(value, 10) || 1;
    setReferencias(newRefs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bloqueia duplo envio
    if (enviando.current) return;

    if (!urlPlanilha) return toast.error("Vá em Configurações e vincule a planilha de Demandas primeiro.");

    const refsValidas = referencias.filter(r => r.ref.trim() !== "");
    if (!form.consultor || !form.cliente || refsValidas.length === 0) {
      return toast.warning("Preencha os campos obrigatórios e adicione pelo menos uma referência!");
    }

    enviando.current = true;
    setProgresso({ atual: 0, total: refsValidas.length });

    const abaDestino = tipo === "ALERTA" ? "DB-ALERTA_DE_DEMANDA" : "DB-VENDA_FUTURA";
    const dataDeHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    try {
      for (let i = 0; i < refsValidas.length; i++) {
        setProgresso({ atual: i + 1, total: refsValidas.length });
        
        const prefix = tipo === "ALERTA" ? "ALD" : "VDF";
        const idDemanda = `${prefix}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

        // A=ID_DEMANDA | B=DATA | C=CONSULTOR | D=CLIENTE | E=CONTATO | F=REF | G=QTDE | H=STATUS | I=THREAD_ID
        await saveDemanda({
          url: urlPlanilha,
          aba: abaDestino,
          dados: [
            idDemanda,
            dataDeHoje,
            form.consultor.toUpperCase(),
            form.cliente.toUpperCase(),
            form.contato,
            refsValidas[i].ref.trim(),
            refsValidas[i].qtd,
            "AGUARDANDO",
            ""
          ]
        });
      }
      toast.success(`${tipo === "ALERTA" ? "Alerta(s)" : "Venda(s)"} registrado(s) com sucesso!`);
      setForm({ consultor: "", cliente: "", contato: "" });
      setReferencias([{ref: "", qtd: 1}]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error("ERRO: " + err.message);
      } else {
        toast.error("ERRO DESCONHECIDO");
      }
    } finally {
      enviando.current = false;
      setProgresso(null);
    }
  };

  const isDisabled = isSubmitting || !urlPlanilha;

  return (
    <MainLayout>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="text-brand-secondary" size={32} />
            Registro de Demandas
          </h1>
          <p className="text-white/50 font-medium mt-1">
            Cadastre produtos para que o sistema monitore as chegadas automaticamente.
          </p>
        </div>

        {!urlPlanilha && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-amber-400">
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

        <Card className="p-6 md:p-8 shadow-lg bg-glass border-glass-border backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Tipo de Registro</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipo("ALERTA")}
                  disabled={isDisabled}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "ALERTA" ? "border-red-500/50 bg-red-500/10 text-red-400" : "border-white/10 bg-black/20 text-white/40 hover:bg-black/40 hover:text-white"
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <AlertTriangle size={24} className="mb-2" />
                  <span className="font-bold">Alerta de Demanda</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipo("VENDA")}
                  disabled={isDisabled}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    tipo === "VENDA" ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-white/10 bg-black/20 text-white/40 hover:bg-black/40 hover:text-white"
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <TrendingUp size={24} className="mb-2" />
                  <span className="font-bold">Venda Futura</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Consultor *</label>
                <Input name="consultor" value={form.consultor} onChange={handleChange} placeholder="Seu nome" className="bg-black/20 border-white/10 text-white placeholder:text-white/20 uppercase" disabled={isDisabled} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Cliente *</label>
                <Input name="cliente" value={form.cliente} onChange={handleChange} placeholder="Nome do cliente" className="bg-black/20 border-white/10 text-white placeholder:text-white/20 uppercase" disabled={isDisabled} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><Phone size={14} /> Contato (WhatsApp)</label>
                <Input name="contato" value={form.contato} onChange={handlePhoneChange} placeholder="(00) 00000-0000" className="bg-black/20 border-white/10 text-white placeholder:text-white/20" disabled={isDisabled} />
              </div>
            </div>

            <div className="bg-black/20 p-5 rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <PackageSearch size={14} /> Referências (SKU) *
                </label>
                <button type="button" onClick={handleAddRef} disabled={isDisabled} className="flex items-center gap-1 text-xs font-bold text-brand-secondary hover:text-white uppercase disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus size={14} /> Adicionar Produto
                </button>
              </div>

              <div className="space-y-3">
                {referencias.map((refObj, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Input
                      value={refObj.ref}
                      onChange={(e) => handleRefChange(index, e.target.value)}
                      placeholder="EX: 123456"
                      className="font-mono bg-black/40 border-white/10 text-white uppercase flex-1"
                      disabled={isDisabled}
                    />
                    <Input
                      type="number"
                      min="1"
                      value={refObj.qtd || 1}
                      onChange={(e) => handleQtdChange(index, e.target.value)}
                      placeholder="Qtd"
                      className="w-24 bg-black/40 border-white/10 text-white text-center"
                      disabled={isDisabled}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveRef(index)}
                      disabled={referencias.length === 1 || isDisabled}
                      className={`p-2 rounded-lg transition-colors ${referencias.length === 1 || isDisabled ? 'text-white/20 cursor-not-allowed' : 'text-red-400 hover:bg-red-500/20'}`}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isDisabled}
              className={`w-full py-6 text-lg font-bold shadow-md transition-all ${
                !urlPlanilha ? 'bg-white/10 text-white/40' : tipo === "ALERTA" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="animate-spin" size={20} />
                  {progresso && progresso.total > 1
                    ? `Salvando ${progresso.atual} de ${progresso.total}...`
                    : "Salvando..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save size={20} />
                  Salvar {tipo === "ALERTA" ? "Alerta" : "Venda Futura"}
                </span>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
}