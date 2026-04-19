/**
 * client/src/pages/avarias/Avarias.tsx
 */

import { useState, useMemo } from "react";
import { 
  Plus, Search, RefreshCw, Link2, X, AlertOctagon, 
  CheckCircle2, Clock, Truck, TableProperties 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const FABRICAS = [
  { nome: "Cutelaria", prefixo: "CTL" },
  { nome: "Farroupilha", prefixo: "FRP" },
  { nome: "CD SUL", prefixo: "CDS" },
  { nome: "TEEC", prefixo: "TEC" },
  { nome: "Belém", prefixo: "BLM" }
];

export default function GestaoAvarias() {
  const [urlPlanilha, setUrlPlanilha] = useState("");
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filtroSku, setFiltroSku] = useState("");

  const { data: todasAvarias = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha },
    { enabled: false }
  );

  const mutationAdd = trpc.notifications.addAvaria.useMutation({
    onSuccess: () => {
      toast.success("Avaria registrada com sucesso!");
      setShowModal(false);
      refetch(); // Atualiza a lista automaticamente após salvar
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

  // 🛡️ A NOSSA FUNÇÃO INTELIGENTE DE VINCULAR
  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Por favor, insira o link da planilha de Avarias.");
    if (!urlPlanilha.includes("docs.google.com/spreadsheets")) return toast.error("Link inválido. Insira um link do Google Sheets.");

    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast.error(`Falha no acesso: ${result.error?.message}`);
        setIsVinculado(false);
      } else if (result.data && result.data.length === 0) {
        toast.warning("A planilha foi lida, mas parece estar vazia.");
        setIsVinculado(true);
      } else {
        toast.success("Planilha de Avarias vinculada com sucesso!");
        setIsVinculado(true);
      }
    } catch (error) {
      toast.error("Erro inesperado de conexão.");
      setIsVinculado(false);
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleAtualizar = async () => {
    setIsSincronizando(true);
    const result = await refetch();
    if (result.isError) {
      toast.error(`Falha ao atualizar: ${result.error?.message}`);
    } else {
      toast.success("Dados de Avarias atualizados!");
    }
    setIsSincronizando(false);
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    toast.info("Planilha desvinculada.");
  };

  const calcularProximoCodigo = (fabricaNome: string) => {
    const fabrica = FABRICAS.find(f => f.nome === fabricaNome);
    if (!fabrica) return "";
    const codigosExistentes = todasAvarias
      .map((a: any) => String(a.COD__AVARIA || ""))
      .filter((c: string) => c.startsWith(fabrica.prefixo));
      
    if (codigosExistentes.length === 0) return `${fabrica.prefixo}0001`;
    
    const numeros = codigosExistentes.map((c: string) => {
      const num = parseInt(c.replace(fabrica.prefixo, ""), 10);
      return isNaN(num) ? 0 : num;
    });
    const maiorNumero = Math.max(...numeros);
    return `${fabrica.prefixo}${String(maiorNumero + 1).padStart(4, '0')}`;
  };

  const [form, setForm] = useState({
    fabrica: "", ref: "", descricao: "", qtde: "1",
    nfEntrada: "", motivo: "", responsavel: "", status: "PENDENTE"
  });

  const handleSalvar = async () => {
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Preencha Fábrica, REF e Quantidade.");
    
    const codAvaria = calcularProximoCodigo(form.fabrica);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    const novaLinha = [
      dataHoje, form.fabrica, codAvaria, form.ref, form.descricao, 
      form.qtde, form.nfEntrada, form.motivo, form.responsavel,
      "NÃO", "", "SIM", form.status, "", "", ""
    ];
    mutationAdd.mutate({ url: urlPlanilha, row: novaLinha });
  };

  const avariasFiltradas = useMemo(() => {
    return todasAvarias.filter((a: any) => 
      !filtroSku || String(a.REF_ || "").toLowerCase().includes(filtroSku.toLowerCase())
    );
  }, [todasAvarias, filtroSku]);

  return (
    <MainLayout>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Avarias</h1>
            <p className="text-gray-600 mt-1">Controle de entradas, tratativas e baixas de produtos danificados</p>
          </div>
          {isVinculado && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg transition-all active:scale-95">
              <Plus size={20} /> Nova Avaria
            </button>
          )}
        </div>

        {/* MÓDULO DE VINCULAÇÃO BLINDADO */}
        <Card className="p-4 border border-red-100 bg-red-50/30 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1 block">Link da Planilha de Avarias</span>
            <Input 
              placeholder="Cole o link aqui..." 
              value={urlPlanilha} 
              onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado}
              className="bg-white border-red-200" 
            />
          </div>
          <div className="flex items-end gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-2.5 rounded-md font-medium transition-all">
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />} Vincular
              </button>
            ) : (
              <>
                <button onClick={handleAtualizar} disabled={isSincronizando} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-md font-medium transition-all">
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
                </button>
                <button onClick={handleCancelar} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-2.5 rounded-md font-medium transition-all">
                  <X size={18} /> Cancelar
                </button>
              </>
            )}
          </div>
        </Card>

        {!isVinculado && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <TableProperties size={64} className="mb-4 text-gray-300" />
            <h3 className="text-xl font-medium text-gray-500">Aguardando vinculação de dados</h3>
            <p className="text-sm mt-2 text-center max-w-md">Cole o link da sua planilha de avarias para gerir as ocorrências.</p>
          </div>
        )}

        {isVinculado && (
          <div className="animate-in fade-in duration-500">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <Input 
                    placeholder="Buscar por REF/SKU..." 
                    className="pl-10 bg-white" 
                    value={filtroSku}
                    onChange={(e) => setFiltroSku(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold shadow-sm">
                    <Clock size={12} /> {todasAvarias.filter((a: any) => a.STATUS === "PENDENTE").length} Pendentes
                  </span>
                  <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold shadow-sm">
                    <Truck size={12} /> {todasAvarias.filter((a: any) => a.STATUS === "COLETADO" || a.STATUS === "CONCLUIDO").length} Finalizadas
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-slate-500 text-xs uppercase sticky top-0 border-b z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3">Cód. Avaria</th>
                      <th className="px-4 py-3">REF</th>
                      <th className="px-4 py-3 w-1/4">Descrição</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3 text-center">Qtde</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {avariasFiltradas.map((av: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{av.COD__AVARIA || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{av.REF_ || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{av.DESCRICAO || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{av.MOTIVO || '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{av.QTDE_ || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            av.STATUS === 'PENDENTE' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {av.STATUS || 'SEM STATUS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {avariasFiltradas.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* MODAL / FORMULÁRIO LATERAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertOctagon className="text-red-600" /> Novo Registro
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Fábrica *</label>
                  <select 
                    className="w-full border border-slate-300 p-2.5 rounded-md bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none"
                    value={form.fabrica}
                    onChange={(e) => setForm({...form, fabrica: e.target.value})}
                  >
                    <option value="">Selecione a unidade...</option>
                    {FABRICAS.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1">REF (SKU) *</label>
                    <Input className="bg-slate-50" value={form.ref} onChange={(e) => setForm({...form, ref: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Quantidade *</label>
                    <Input className="bg-slate-50" type="number" min="1" value={form.qtde} onChange={(e) => setForm({...form, qtde: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Descrição do Produto</label>
                  <Input className="bg-slate-50" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Nota Fiscal de Entrada</label>
                  <Input className="bg-slate-50" value={form.nfEntrada} onChange={(e) => setForm({...form, nfEntrada: e.target.value})} />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Motivo da Avaria</label>
                  <textarea 
                    className="w-full border border-slate-300 p-2.5 rounded-md text-sm h-24 bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                    placeholder="Descreva o que aconteceu..."
                    value={form.motivo}
                    onChange={(e) => setForm({...form, motivo: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Responsável</label>
                  <Input className="bg-slate-50" placeholder="Nome de quem está lançando..." value={form.responsavel} onChange={(e) => setForm({...form, responsavel: e.target.value})} />
                </div>

                <div className="pt-6 border-t mt-6 flex flex-col gap-3">
                  <button 
                    onClick={handleSalvar}
                    disabled={mutationAdd.isPending}
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-md disabled:bg-red-400"
                  >
                    {mutationAdd.isPending ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />} 
                    Salvar Registro
                  </button>
                  <button onClick={() => setShowModal(false)} className="w-full text-slate-500 font-bold py-2 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}