/**
 * client/src/pages/avarias/Avarias.tsx
 */

import React, { useState, useMemo } from "react";
import { 
  Plus, Search, RefreshCw, Link2, X, AlertOctagon, 
  CheckCircle2, Clock, Truck, TableProperties, 
  ChevronDown, ChevronUp, Info, Tag, Timer, PackageCheck, HelpCircle
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
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data: todasAvarias = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha },
    { enabled: false }
  );

  const mutationAdd = trpc.notifications.addAvaria.useMutation({
    onSuccess: () => {
      toast.success("Avaria registrada com sucesso!");
      setShowModal(false);
      refetch();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

  // 🎨 NOVA PALETA DE CORES SOLICITADA
  const getTratativaStyle = (texto: string) => {
    if (!texto) return { class: "bg-slate-100 text-slate-500 border-slate-200", icon: <HelpCircle size={10}/> };
    const t = texto.toUpperCase().trim();
    
    // 1. PENDENTE - Vermelho (Alerta)
    if (t === "PENDENTE") 
      return { class: "bg-red-100 text-red-700 border-red-300", icon: <AlertOctagon size={10}/> };
    
    // 2. AGUARDANDO COLETA - Azul (Informativo/Espera)
    if (t === "AGUARDANDO COLETA") 
      return { class: "bg-blue-100 text-blue-700 border-blue-300", icon: <Timer size={10}/> };
    
    // 3. EM PROCESSO - Amarelo (Atenção/Em andamento)
    if (t === "EM PROCESSO") 
      return { class: "bg-amber-100 text-amber-700 border-amber-300", icon: <Truck size={10}/> };
    
    // 4. CONCLUÍDA - Verde (Sucesso/Finalizado)
    if (t === "CONCLUÍDA" || t === "CONCLUIDA") 
      return { class: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <PackageCheck size={10}/> };

    // Fallbacks inteligentes
    if (t.includes("PENDENTE")) return { class: "bg-red-100 text-red-700 border-red-300", icon: <AlertOctagon size={10}/> };
    if (t.includes("COLETA")) return { class: "bg-blue-100 text-blue-700 border-blue-300", icon: <Timer size={10}/> };
    if (t.includes("PROCESSO")) return { class: "bg-amber-100 text-amber-700 border-amber-300", icon: <Truck size={10}/> };
    if (t.includes("CONCLU")) return { class: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <PackageCheck size={10}/> };

    return { class: "bg-slate-100 text-slate-600 border-slate-200", icon: <Tag size={10}/> };
  };

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Insira o link da planilha.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (result.isError) toast.error("Falha no acesso à planilha.");
      else {
        toast.success("Dados vinculados com sucesso!");
        setIsVinculado(true);
      }
    } catch (error) { toast.error("Erro de conexão com o servidor."); }
    finally { setIsSincronizando(false); }
  };

  const handleAtualizar = async () => {
    setIsSincronizando(true);
    await refetch();
    toast.success("Lista de avarias atualizada!");
    setIsSincronizando(false);
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    setExpandedRow(null);
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
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Preencha fábrica, referência e quantidade.");
    const codAvaria = calcularProximoCodigo(form.fabrica);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const novaLinha = [
      dataHoje, form.fabrica, codAvaria, form.ref, form.descricao, 
      form.qtde, form.nfEntrada, form.motivo, form.responsavel,
      "NÃO", "PENDENTE", "SIM", "PENDENTE", "", "", ""
    ];
    mutationAdd.mutate({ url: urlPlanilha, row: novaLinha });
  };

  const avariasFiltradas = useMemo(() => {
    return todasAvarias.filter((a: any) => 
      !filtroSku || String(a.REF_ || "").toLowerCase().includes(filtroSku.toLowerCase()) ||
      String(a.COD__AVARIA || "").toLowerCase().includes(filtroSku.toLowerCase())
    );
  }, [todasAvarias, filtroSku]);

  return (
    <MainLayout>
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Avarias</h1>
            <p className="text-slate-500 text-sm">Monitoramento e fluxo de tratativas logísticas</p>
          </div>
          {isVinculado && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all hover:scale-105 active:scale-95">
              <Plus size={20} /> Nova Avaria
            </button>
          )}
        </div>

        {/* VINCULAÇÃO */}
        <Card className="p-4 border-red-100 bg-red-50/30 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="flex-1 w-full">
            <span className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1 block">Planilha DB-AVARIAS</span>
            <Input placeholder="Cole o link do Google Sheets..." value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white border-red-200 rounded-lg" />
          </div>
          <div className="flex gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="flex-1 bg-red-600 text-white px-8 py-2.5 rounded-lg font-bold shadow-md">Vincular</button>
            ) : (
              <>
                <button onClick={handleAtualizar} disabled={isSincronizando} className="flex-1 bg-white border border-emerald-200 text-emerald-700 px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors">
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar Dados
                </button>
                <button onClick={handleCancelar} className="p-2.5 text-slate-400 hover:text-red-600 transition-colors"><X size={24}/></button>
              </>
            )}
          </div>
        </Card>

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-xl">
            <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
              <div className="relative w-80">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input placeholder="Buscar por REF ou Código..." className="pl-10 bg-white rounded-full border-slate-200" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 text-xs font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                   <AlertOctagon size={14}/> {todasAvarias.filter((a:any) => String(a.TRATATIVA).toUpperCase() === 'PENDENTE').length} Pendentes
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4 w-10"></th>
                    <th className="px-4 py-4">Cód. Avaria</th>
                    <th className="px-4 py-4">REF</th>
                    <th className="px-4 py-4 w-1/3">Descrição</th>
                    <th className="px-4 py-4 text-center">Qtde</th>
                    <th className="px-4 py-4">NF Entrada</th>
                    <th className="px-6 py-4 text-right">Tratativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {avariasFiltradas.map((av: any, idx: number) => {
                    const isExpanded = expandedRow === idx;
                    const tratativa = getTratativaStyle(av.TRATATIVA);
                    
                    return (
                      <React.Fragment key={idx}>
                        <tr onClick={() => setExpandedRow(isExpanded ? null : idx)} className={`cursor-pointer transition-all ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}>
                          <td className="px-6 py-5 text-slate-300">
                            {isExpanded ? <ChevronUp size={20} className="text-red-500" /> : <ChevronDown size={20} />}
                          </td>
                          <td className="px-4 py-5 font-bold text-slate-900">{av.COD__AVARIA || '-'}</td>
                          <td className="px-4 py-5"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{av.REF_ || '-'}</span></td>
                          <td className="px-4 py-5 text-slate-600 font-medium">{av.DESCRICAO || '-'}</td>
                          <td className="px-4 py-5 text-center font-black text-red-600 text-base">{av.QTDE_ || '-'}</td>
                          <td className="px-4 py-5 text-slate-500">{av.NOTA_FISCAL_DE_ENTRADA || '-'}</td>
                          <td className="px-6 py-5 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase border shadow-sm transition-all ${tratativa.class}`}>
                              {tratativa.icon}
                              {av.TRATATIVA || 'PENDENTE'}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="px-10 py-8">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b pb-1 flex items-center gap-2"><Info size={12}/> Identificação</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Lançamento</p><p className="font-semibold text-slate-700">{av.DATA_DE_ENTRADA || '-'}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Origem</p><p className="font-semibold text-slate-700">{av.FABRICA || '-'}</p></div>
                                  </div>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Responsável</p><p className="font-semibold text-slate-700">{av.RESPONSAVEL || '-'}</p></div>
                                </div>

                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b pb-1 flex items-center gap-2"><AlertOctagon size={12}/> Detalhes da Avaria</h4>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Motivo Relatado</p><p className="text-xs text-slate-600 italic bg-white p-3 rounded-lg border border-slate-200 mt-1 leading-relaxed">{av.MOTIVO || 'Descrição não fornecida.'}</p></div>
                                  <div className="flex gap-3">
                                    <div className={`px-2 py-1 rounded text-[10px] font-black border ${av.CONSTA_FISICAMENTE_ === 'SIM' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>FÍSICO: {av.CONSTA_FISICAMENTE_}</div>
                                    <div className={`px-2 py-1 rounded text-[10px] font-black border ${av.FOI_LANCADO_NO_SISTEMA_ === 'SIM' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>SISTEMA: {av.FOI_LANCADO_NO_SISTEMA_}</div>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b pb-1 flex items-center gap-2"><Truck size={12}/> Movimentação</h4>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Status Interno</p><p className="text-xs font-black text-slate-800">{av.STATUS || 'PENDENTE'}</p></div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">NF Saída</p><p className="text-xs font-medium text-slate-600">{av.NOTA_FISCAL_DE_SAIDA || '-'}</p></div>
                                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">NF Reposição</p><p className="text-xs font-medium text-slate-600">{av.NOTA_FISCAL_DE_REPOSICAO || '-'}</p></div>
                                    </div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Previsão Coleta</p><p className="text-xs font-medium text-slate-600">{av.DATA_DA_COLETA || '-'}</p></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* MODAL / FORMULÁRIO */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
             <div className="w-full max-w-md bg-white h-full shadow-2xl p-8 overflow-y-auto animate-in slide-in-from-right duration-300">
               <div className="flex justify-between items-center mb-8 border-b pb-4">
                 <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><AlertOctagon className="text-red-600" /> Registrar Avaria</h2>
                 <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X /></button>
               </div>
               
               <div className="space-y-5">
                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Unidade / Fábrica</label>
                 <select className="w-full border-slate-200 p-3 rounded-lg bg-slate-50 mt-1 focus:ring-2 focus:ring-red-500 outline-none transition-all" value={form.fabrica} onChange={(e) => setForm({...form, fabrica: e.target.value})}>
                   <option value="">Selecione...</option>
                   {FABRICAS.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                 </select></div>

                 <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Referência</label><Input className="mt-1" value={form.ref} onChange={(e) => setForm({...form, ref: e.target.value})} /></div>
                   <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Quantidade</label><Input className="mt-1" type="number" value={form.qtde} onChange={(e) => setForm({...form, qtde: e.target.value})} /></div>
                 </div>

                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Descrição do Produto</label><Input className="mt-1" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NF de Entrada</label><Input className="mt-1" value={form.nfEntrada} onChange={(e) => setForm({...form, nfEntrada: e.target.value})} /></div>
                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Motivo</label><textarea className="w-full border-slate-200 p-3 rounded-lg bg-slate-50 h-24 text-sm mt-1 focus:ring-2 focus:ring-red-500 outline-none" placeholder="Relate o dano..." value={form.motivo} onChange={(e) => setForm({...form, motivo: e.target.value})} /></div>
                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsável</label><Input className="mt-1" value={form.responsavel} onChange={(e) => setForm({...form, responsavel: e.target.value})} /></div>

                 <button onClick={handleSalvar} disabled={mutationAdd.isPending} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-slate-300">
                   {mutationAdd.isPending ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />} Concluir Lançamento
                 </button>
               </div>
             </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}