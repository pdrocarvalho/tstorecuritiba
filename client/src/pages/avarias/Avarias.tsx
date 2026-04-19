/**
 * client/src/pages/avarias/Avarias.tsx
 */

import React, { useState, useMemo } from "react";
import { 
  Plus, Search, RefreshCw, Link2, X, AlertOctagon, 
  CheckCircle2, Clock, Truck, TableProperties, 
  ChevronDown, ChevronUp, Info, Tag, Timer, PackageCheck, 
  HelpCircle, Printer, Filter
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

// Definição dos Status para os Filtros
const STATUS_OPTIONS = [
  { id: "PENDENTE", label: "Pendente", color: "red" },
  { id: "AGUARDANDO COLETA", label: "Aguardando Coleta", color: "blue" },
  { id: "EM PROCESSO", label: "Em Processo", color: "amber" },
  { id: "CONCLUÍDA", label: "Concluída", color: "emerald" },
];

export default function GestaoAvarias() {
  const [urlPlanilha, setUrlPlanilha] = useState("");
  const [isVinculado, setIsVinculado] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filtroSku, setFiltroSku] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  
  // 🚀 NOVO: Estado para Multi-Seleção de Filtros
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);

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

  const getTratativaStyle = (texto: string) => {
    if (!texto) return { class: "bg-slate-100 text-slate-500 border-slate-200", color: "slate", icon: <HelpCircle size={10}/> };
    const t = texto.toUpperCase().trim();
    if (t === "PENDENTE") return { class: "bg-red-100 text-red-700 border-red-300", color: "red", icon: <AlertOctagon size={10}/> };
    if (t === "AGUARDANDO COLETA") return { class: "bg-blue-100 text-blue-700 border-blue-300", color: "blue", icon: <Timer size={10}/> };
    if (t === "EM PROCESSO") return { class: "bg-amber-100 text-amber-700 border-amber-300", color: "amber", icon: <Truck size={10}/> };
    if (t === "CONCLUÍDA" || t === "CONCLUIDA") return { class: "bg-emerald-100 text-emerald-700 border-emerald-300", color: "emerald", icon: <PackageCheck size={10}/> };
    return { class: "bg-slate-100 text-slate-600 border-slate-200", color: "slate", icon: <Tag size={10}/> };
  };

  const toggleFiltro = (statusId: string) => {
    setFiltrosAtivos(prev => 
      prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]
    );
  };

  // 🚀 LÓGICA DE FILTRAGEM MULTI-CRITÉRIO
  const avariasFiltradas = useMemo(() => {
    return todasAvarias.filter((a: any) => {
      const search = filtroSku.toLowerCase();
      const matchesSearch = !filtroSku || 
        String(a.REF_ || "").toLowerCase().includes(search) ||
        String(a.COD__AVARIA || "").toLowerCase().includes(search);

      const tratativaRow = String(a.TRATATIVA || "PENDENTE").toUpperCase().trim();
      const matchesStatus = filtrosAtivos.length === 0 || filtrosAtivos.includes(tratativaRow);

      return matchesSearch && matchesStatus;
    });
  }, [todasAvarias, filtroSku, filtrosAtivos]);

  // 🚀 FUNÇÃO DE IMPRESSÃO (RESPEITANDO FILTROS)
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Relatório de Avarias - T Store</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f8f9fa; font-weight: bold; text-transform: uppercase; }
            .header { text-align: center; margin-bottom: 30px; }
            .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório de Gestão de Avarias</h1>
            <p>Data de Emissão: ${new Date().toLocaleString()}</p>
            <p>Filtros Ativos: ${filtrosAtivos.length > 0 ? filtrosAtivos.join(", ") : "Todos"}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cód. Avaria</th>
                <th>REF</th>
                <th>Descrição</th>
                <th>Qtde</th>
                <th>NF Entrada</th>
                <th>Tratativa</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              ${avariasFiltradas.map(av => `
                <tr>
                  <td>${av.COD__AVARIA || "-"}</td>
                  <td>${av.REF_ || "-"}</td>
                  <td>${av.DESCRICAO || "-"}</td>
                  <td style="text-align:center"><b>${av.QTDE_ || "0"}</b></td>
                  <td>${av.NOTA_FISCAL_DE_ENTRADA || "-"}</td>
                  <td><span class="badge">${av.TRATATIVA || "PENDENTE"}</span></td>
                  <td style="font-size: 10px">${av.MOTIVO || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">Gerado por T Store Admin System</div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleVincular = async () => {
    if (!urlPlanilha) return toast.warning("Insira o link da planilha.");
    setIsSincronizando(true);
    try {
      const result = await refetch();
      if (result.isError) toast.error("Falha no acesso.");
      else { toast.success("Dados vinculados!"); setIsVinculado(true); }
    } catch (error) { toast.error("Erro de conexão."); }
    finally { setIsSincronizando(false); }
  };

  const [form, setForm] = useState({ fabrica: "", ref: "", descricao: "", qtde: "1", nfEntrada: "", motivo: "", responsavel: "", status: "PENDENTE" });

  const handleSalvar = async () => {
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Preencha os campos obrigatórios.");
    const fabrica = FABRICAS.find(f => f.nome === form.fabrica);
    const codigos = todasAvarias.map((a: any) => String(a.COD__AVARIA || "")).filter((c: string) => c.startsWith(fabrica?.prefixo || ""));
    const num = codigos.length > 0 ? Math.max(...codigos.map(c => parseInt(c.replace(/[^\d]/g, ""), 10))) + 1 : 1;
    const codAvaria = `${fabrica?.prefixo}${String(num).padStart(4, '0')}`;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const novaLinha = [dataHoje, form.fabrica, codAvaria, form.ref, form.descricao, form.qtde, form.nfEntrada, form.motivo, form.responsavel, "NÃO", "PENDENTE", "SIM", "PENDENTE", "", "", ""];
    mutationAdd.mutate({ url: urlPlanilha, row: novaLinha });
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Avarias</h1>
            <p className="text-slate-500 text-sm">Painel operacional e monitoramento de tratativas</p>
          </div>
          {isVinculado && (
            <div className="flex gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-95">
                <Printer size={20} /> Imprimir
              </button>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all hover:scale-105 active:scale-95">
                <Plus size={20} /> Registrar Avaria
              </button>
            </div>
          )}
        </div>

        {/* VINCULAÇÃO */}
        <Card className="p-4 border-red-100 bg-red-50/30 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="flex-1 w-full">
            <span className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1 block">Planilha Fonte</span>
            <Input placeholder="Cole o link do Google Sheets..." value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white border-red-200 rounded-lg" />
          </div>
          <div className="flex gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button onClick={handleVincular} disabled={isSincronizando} className="flex-1 bg-red-600 text-white px-8 py-2.5 rounded-lg font-bold">Vincular</button>
            ) : (
              <>
                <button onClick={() => refetch()} disabled={isSincronizando} className="flex-1 bg-white border border-emerald-200 text-emerald-700 px-6 py-2.5 rounded-lg font-bold flex items-center gap-2">
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
                </button>
                <button onClick={() => { setIsVinculado(false); setUrlPlanilha(""); }} className="p-2.5 text-slate-400 hover:text-red-600"><X size={24}/></button>
              </>
            )}
          </div>
        </Card>

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-xl">
            {/* 🚀 CABEÇALHO COM FILTROS AVANÇADOS */}
            <div className="p-5 border-b bg-slate-50/50 flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-4 top-3 text-slate-400" size={20} />
                  <Input placeholder="Buscar por REF ou Código..." className="pl-12 h-12 bg-white rounded-xl border-slate-200 shadow-sm focus:ring-2 focus:ring-red-500" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value)} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1">
                    <Filter size={12} /> Filtrar Tratativa:
                  </span>
                  {STATUS_OPTIONS.map(status => {
                    const isActive = filtrosAtivos.includes(status.id);
                    return (
                      <button
                        key={status.id}
                        onClick={() => toggleFiltro(status.id)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase border transition-all shadow-sm ${
                          isActive 
                          ? `bg-${status.color}-600 text-white border-${status.color}-700 scale-105 shadow-md` 
                          : `bg-white text-slate-500 border-slate-200 hover:border-${status.color}-300 hover:text-${status.color}-600`
                        }`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                  {filtrosAtivos.length > 0 && (
                    <button onClick={() => setFiltrosAtivos([])} className="text-[10px] font-bold text-red-500 hover:underline px-2">Limpar</button>
                  )}
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
                          <td className="px-6 py-5 text-slate-300">{isExpanded ? <ChevronUp size={20} className="text-red-500" /> : <ChevronDown size={20} />}</td>
                          <td className="px-4 py-5 font-bold text-slate-900">{av.COD__AVARIA || '-'}</td>
                          <td className="px-4 py-5"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono">{av.REF_ || '-'}</span></td>
                          <td className="px-4 py-5 text-slate-600 font-medium">{av.DESCRICAO || '-'}</td>
                          <td className="px-4 py-5 text-center font-black text-red-600 text-base">{av.QTDE_ || '-'}</td>
                          <td className="px-4 py-5 text-slate-500">{av.NOTA_FISCAL_DE_ENTRADA || '-'}</td>
                          <td className="px-6 py-5 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase border shadow-sm ${tratativa.class}`}>
                              {tratativa.icon} {av.TRATATIVA || 'PENDENTE'}
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
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Lançamento</p><p className="font-semibold">{av.DATA_DE_ENTRADA || '-'}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Origem</p><p className="font-semibold">{av.FABRICA || '-'}</p></div>
                                  </div>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Responsável</p><p className="font-semibold">{av.RESPONSAVEL || '-'}</p></div>
                                </div>
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-tighter border-b pb-1 flex items-center gap-2"><AlertOctagon size={12}/> Detalhes</h4>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Motivo Relatado</p><p className="text-xs text-slate-600 italic bg-white p-3 rounded-lg border border-slate-200 mt-1 leading-relaxed">{av.MOTIVO || 'Não informado.'}</p></div>
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
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Data Coleta</p><p className="text-xs font-medium text-slate-600">{av.DATA_DA_COLETA || '-'}</p></div>
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
                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Descrição</label><Input className="mt-1" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
                 <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Motivo</label><textarea className="w-full border-slate-200 p-3 rounded-lg bg-slate-50 h-24 text-sm mt-1 focus:ring-2 focus:ring-red-500 outline-none" value={form.motivo} onChange={(e) => setForm({...form, motivo: e.target.value})} /></div>
                 <button onClick={handleSalvar} disabled={mutationAdd.isPending} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-slate-300">
                   {mutationAdd.isPending ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />} Salvar Avaria
                 </button>
               </div>
             </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}