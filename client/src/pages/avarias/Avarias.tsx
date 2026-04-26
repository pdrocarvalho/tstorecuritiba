/**
 * client/src/pages/avarias/Avarias.tsx
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, Search, RefreshCw, X, AlertOctagon, 
  CheckCircle2, Clock, Truck, TableProperties, 
  ChevronDown, ChevronUp, Info, Tag, Timer, PackageCheck, 
  HelpCircle, Printer, Filter, Save, Edit, Trash2, Lock
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";

const FABRICAS = [
  { nome: "Cutelaria", prefixo: "CTL" },
  { nome: "Farroupilha", prefixo: "FRP" },
  { nome: "CD SUL", prefixo: "CDS" },
  { nome: "TEEC", prefixo: "TEC" },
  { nome: "Belém", prefixo: "BLM" }
];

const STATUS_OPTIONS = [
  { id: "PENDENTE", label: "Pendente", color: "red" },
  { id: "AGUARDANDO COLETA", label: "Aguardando Coleta", color: "blue" },
  { id: "EM PROCESSO", label: "Em Processo", color: "amber" },
  { id: "CONCLUÍDA", label: "Concluída", color: "emerald" },
];

const FORM_VAZIO = {
  fabrica: "", ref: "", descricao: "", qtde: "1", nfEntrada: "", motivo: "", responsavel: "", 
  tratativa: "PENDENTE", status: "PENDENTE", constaFisicamente: "SIM", lancadoSistema: "NÃO",
  nfSaida: "", nfReposicao: "", dataColeta: ""
};

export default function GestaoAvarias() {
  // 🚀 ATUALIZADO: Agora busca a URL diretamente do cofre central (localStorage)
  const [urlPlanilha] = useState(() => localStorage.getItem("url_avarias") || "");
  const isVinculado = !!urlPlanilha;

  const [showModal, setShowModal] = useState(false);
  const [filtroSku, setFiltroSku] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);

  // ESTADOS DO CRUD E SEGURANÇA
  const [editingAvaria, setEditingAvaria] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  
  const [pinModal, setPinModal] = useState<{ isOpen: boolean, action: 'edit' | 'delete' | null, avariaTarget?: any }>({ isOpen: false, action: null });
  const [pinValue, setPinValue] = useState("");

  const { data: todasAvarias = [], refetch, isFetching } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'avarias' }, 
    { enabled: isVinculado }
  );

  useEffect(() => {
    if (isVinculado) refetch();
  }, [isVinculado]);

  // ==========================================
  // MUTATIONS (As setas para o Backend)
  // ==========================================

  const mutationAdd = trpc.notifications.addAvaria.useMutation({
    onSuccess: () => {
      toast.success("Avaria registrada com sucesso!");
      fecharModais();
      refetch();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

  const mutationEdit = trpc.notifications.editAvariaFull.useMutation({
    onSuccess: () => {
      toast.success("Avaria atualizada com sucesso!");
      fecharModais();
      refetch();
    },
    onError: (err) => toast.error("Erro na edição: " + err.message)
  });

  const mutationDelete = trpc.notifications.deleteAvariaRow.useMutation({
    onSuccess: () => {
      toast.success("Avaria excluída permanentemente.");
      fecharModais();
      refetch();
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message)
  });

  // ==========================================
  // FUNÇÕES DE CONTROLE
  // ==========================================

  const fecharModais = () => {
    setShowModal(false);
    setPinModal({ isOpen: false, action: null });
    setEditingAvaria(null);
    setForm(FORM_VAZIO);
    setPinValue("");
  };

  const abrirModalNova = () => {
    setEditingAvaria(null);
    setForm(FORM_VAZIO);
    setShowModal(true);
  };

  const abrirModalEdicao = (av: any) => {
    setEditingAvaria(av);
    setForm({
      fabrica: av.FÁBRICA || av.FABRICA || "",
      ref: av.REF_ || "",
      descricao: av.DESCRIÇÃO || av.DESCRICAO || "",
      qtde: av.QTDE_ || "1",
      nfEntrada: av.NOTA_FISCAL_DE_ENTRADA || "",
      motivo: av.MOTIVO || "",
      responsavel: av.RESPONSÁVEL || av.RESPONSAVEL || "",
      tratativa: av.TRATATIVA || "PENDENTE",
      status: av.STATUS || "PENDENTE",
      constaFisicamente: av.CONSTA_FISICAMENTE_ || "NÃO",
      lancadoSistema: av.FOI_LANÇADO_NO_SISTEMA_ || av.FOI_LANCADO_NO_SISTEMA_ || "NÃO",
      nfSaida: av.NOTA_FISCAL_DE_SAÍDA || av.NOTA_FISCAL_DE_SAIDA || "",
      nfReposicao: av.NOTA_FISCAL_DE_REPOSIÇÃO || av.NOTA_FISCAL_DE_REPOSICAO || "",
      dataColeta: av.DATA_DA_COLETA || ""
    });
    setShowModal(true);
  };

  const handleSalvarClicked = () => {
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Campos obrigatórios faltando.");
    
    if (editingAvaria) {
      setPinModal({ isOpen: true, action: 'edit' });
    } else {
      const fabrica = FABRICAS.find(f => f.nome === form.fabrica);
      const prefixo = fabrica?.prefixo || "AVR";
      const codigosExistentes = todasAvarias.map((a: any) => String(a.CÓD__AVARIA || a.COD__AVARIA || "")).filter((c: string) => c.startsWith(prefixo));
      const proximoNumero = codigosExistentes.length > 0 ? Math.max(...codigosExistentes.map(c => parseInt(c.replace(/[^\d]/g, ""), 10) || 0)) + 1 : 1;
      const codAvaria = `${prefixo}${String(proximoNumero).padStart(4, '0')}`;
      
      const novaLinha = [
        new Date().toLocaleDateString('pt-BR'), form.fabrica, codAvaria, form.ref, form.descricao, form.qtde, 
        form.nfEntrada, form.motivo, form.responsavel, "NÃO", "PENDENTE", "SIM", "PENDENTE", "", "", ""
      ];
      mutationAdd.mutate({ url: urlPlanilha, row: novaLinha });
    }
  };

  const executarAcaoComPin = () => {
    if (!pinValue) return toast.warning("Digite a senha de gerente.");

    if (pinModal.action === 'delete' && pinModal.avariaTarget) {
      if (!pinModal.avariaTarget.rowNumber) return toast.error("Erro interno: Número da linha não encontrado.");
      mutationDelete.mutate({ url: urlPlanilha, rowNumber: pinModal.avariaTarget.rowNumber, pin: pinValue });
    } 
    
    else if (pinModal.action === 'edit' && editingAvaria) {
      if (!editingAvaria.rowNumber) return toast.error("Erro interno: Número da linha não encontrado.");
      const linhaAtualizada = [
        editingAvaria.DATA_DE_ENTRADA, 
        form.fabrica,                  
        editingAvaria.CÓD__AVARIA || editingAvaria.COD__AVARIA, 
        form.ref,                      
        form.descricao,                
        form.qtde,                     
        form.nfEntrada,                
        form.motivo,                   
        form.responsavel,              
        form.lancadoSistema,           
        form.tratativa,                
        form.constaFisicamente,        
        form.status,                   
        form.nfSaida,                  
        form.nfReposicao,              
        form.dataColeta                
      ];
      mutationEdit.mutate({ url: urlPlanilha, rowNumber: editingAvaria.rowNumber, row: linhaAtualizada, pin: pinValue });
    }
  };

  // ==========================================
  // FILTROS E ESTILOS
  // ==========================================

  const getTratativaStyle = (texto: string) => {
    if (!texto) return { class: "bg-slate-100 text-slate-500 border-slate-200", icon: <HelpCircle size={10}/> };
    const t = texto.toUpperCase().trim();
    if (t === "PENDENTE") return { class: "bg-red-100 text-red-700 border-red-300", icon: <AlertOctagon size={10}/> };
    if (t === "AGUARDANDO COLETA") return { class: "bg-blue-100 text-blue-700 border-blue-300", icon: <Timer size={10}/> };
    if (t === "EM PROCESSO") return { class: "bg-amber-100 text-amber-700 border-amber-300", icon: <Truck size={10}/> };
    if (t === "CONCLUÍDA" || t === "CONCLUIDA") return { class: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <PackageCheck size={10}/> };
    return { class: "bg-slate-100 text-slate-600 border-slate-200", icon: <Tag size={10}/> };
  };

  const toggleFiltro = (statusId: string) => {
    setFiltrosAtivos(prev => 
      prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]
    );
  };

  const avariasFiltradas = useMemo(() => {
    return todasAvarias.filter((a: any) => {
      const search = filtroSku.toLowerCase();
      const matchesSearch = !filtroSku || String(a.REF_ || "").toLowerCase().includes(search) || String(a.CÓD__AVARIA || a.COD__AVARIA || "").toLowerCase().includes(search);
      const tratativaRow = String(a.TRATATIVA || "PENDENTE").toUpperCase().trim();
      const matchesStatus = filtrosAtivos.length === 0 || filtrosAtivos.includes(tratativaRow);
      return matchesSearch && matchesStatus;
    });
  }, [todasAvarias, filtroSku, filtrosAtivos]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Relatório de Avarias - T Store</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f4f4f4; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Relatório de Gestão de Avarias</h2>
          <table>
            <thead>
              <tr><th>Cód.</th><th>REF</th><th>Descrição</th><th>Qtd</th><th>NF Entrada</th><th>Tratativa</th></tr>
            </thead>
            <tbody>
              ${avariasFiltradas.map((av: any) => `
                <tr>
                  <td>${av.CÓD__AVARIA || av.COD__AVARIA || ""}</td>
                  <td>${av.REF_ || ""}</td>
                  <td>${av.DESCRIÇÃO || av.DESCRICAO || ""}</td>
                  <td><strong style="color: red;">${av.QTDE_ || ""}</strong></td>
                  <td>${av.NOTA_FISCAL_DE_ENTRADA || ""}</td>
                  <td>${av.TRATATIVA || "PENDENTE"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão de Avarias</h1>
            <p className="text-slate-500">Fluxo operacional de produtos danificados</p>
          </div>
          {isVinculado && (
            <div className="flex gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 shadow-sm transition-colors"><Printer size={18}/> Imprimir</button>
              <button onClick={() => refetch()} className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg font-bold hover:bg-emerald-50 shadow-sm transition-colors">
                <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /> Atualizar
              </button>
              <button onClick={abrirModalNova} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg hover:bg-red-700 transition-colors"><Plus size={20}/> Nova Avaria</button>
            </div>
          )}
        </div>

        {/* 🚀 AVISO SE NÃO ESTIVER VINCULADO */}
        {!isVinculado && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertOctagon size={20} />
              <p className="text-sm font-bold">O painel está zerado pois a fonte de dados de Avarias não foi configurada.</p>
            </div>
            <Link href="/configuracoes">
              <button className="bg-amber-600 text-white hover:bg-amber-700 px-6 py-2 rounded-lg font-bold transition-colors">
                Ir para Configurações
              </button>
            </Link>
          </div>
        )}

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-xl">
            <div className="p-5 border-b bg-slate-50/50 flex flex-col lg:flex-row justify-between gap-4">
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input placeholder="Buscar por REF ou Código..." className="pl-10 bg-white" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value)} />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => toggleFiltro(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${filtrosAtivos.includes(s.id) ? `bg-${s.color}-600 text-white border-${s.color}-700` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase border-b tracking-widest">
                  <tr><th className="px-6 py-4 w-10"></th><th className="px-4">Cód.</th><th className="px-4">REF</th><th className="px-4 w-1/3">Descrição</th><th className="px-4 text-center">Qtde</th><th className="px-4">NF Entrada</th><th className="px-6 text-right">Tratativa</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {avariasFiltradas.map((av: any, idx: number) => {
                    const isExpanded = expandedRow === idx;
                    const style = getTratativaStyle(av.TRATATIVA);
                    return (
                      <React.Fragment key={idx}>
                        <tr onClick={() => setExpandedRow(isExpanded ? null : idx)} className={`cursor-pointer transition-all ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}>
                          <td className="px-6 py-5">{isExpanded ? <ChevronUp size={18} className="text-red-500"/> : <ChevronDown size={18}/>}</td>
                          <td className="px-4 font-bold text-slate-900">{av.CÓD__AVARIA || av.COD__AVARIA || '-'}</td>
                          <td className="px-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono text-xs">{av.REF_ || '-'}</span></td>
                          <td className="px-4 text-slate-700 font-medium">{av.DESCRIÇÃO || av.DESCRICAO || '-'}</td>
                          <td className="px-4 text-center font-black text-red-600 text-base">{av.QTDE_ || '-'}</td>
                          <td className="px-4 text-slate-500">{av.NOTA_FISCAL_DE_ENTRADA || '-'}</td>
                          <td className="px-6 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border shadow-sm ${style.class}`}>
                              {style.icon} {av.TRATATIVA || 'PENDENTE'}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="px-10 py-8 relative">
                              <div className="absolute top-4 right-10 flex gap-2">
                                <button onClick={() => abrirModalEdicao(av)} className="flex items-center gap-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">
                                  <Edit size={14} /> Editar
                                </button>
                                <button onClick={() => setPinModal({ isOpen: true, action: 'delete', avariaTarget: av })} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors">
                                  <Trash2 size={14} /> Excluir
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Identificação</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Entrada</p><p className="font-semibold text-slate-700">{av.DATA_DE_ENTRADA || '-'}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Unidade</p><p className="font-semibold text-slate-700">{av.FÁBRICA || av.FABRICA || '-'}</p></div>
                                  </div>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Responsável</p><p className="font-semibold text-slate-700">{av.RESPONSÁVEL || av.RESPONSAVEL || '-'}</p></div>
                                </div>
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Diagnóstico</h4>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Motivo</p><p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200 mt-1">{av.MOTIVO || 'Não informado.'}</p></div>
                                  <div className="flex gap-3">
                                    <div className={`px-2 py-1 rounded text-[10px] font-black border ${av.CONSTA_FISICAMENTE_ === 'SIM' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>FÍSICO: {av.CONSTA_FISICAMENTE_ || '-'}</div>
                                    <div className={`px-2 py-1 rounded text-[10px] font-black border ${av.FOI_LANÇADO_NO_SISTEMA_ === 'SIM' || av.FOI_LANCADO_NO_SISTEMA_ === 'SIM' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>SISTEMA: {av.FOI_LANÇADO_NO_SISTEMA_ || av.FOI_LANCADO_NO_SISTEMA_ || '-'}</div>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Logística</h4>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Status Interno</p><p className="text-xs font-black">{av.STATUS || 'PENDENTE'}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Data Coleta</p><p className="text-xs">{av.DATA_DA_COLETA || '-'}</p></div>
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
      </div>

      {/* MODAL PRINCIPAL (NOVA OU EDITA AVARIA) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center gap-2 text-slate-800">
                {editingAvaria ? <Edit size={20} className="text-blue-600" /> : <AlertOctagon size={20} className="text-red-500" />}
                <h2 className="font-bold text-lg tracking-tight">{editingAvaria ? `Editar Avaria (${editingAvaria.CÓD__AVARIA || editingAvaria.COD__AVARIA})` : "Registrar Nova Avaria"}</h2>
              </div>
              <button onClick={fecharModais} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Dados Principais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fábrica <span className="text-red-500">*</span></label>
                  <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm focus:ring-2 focus:ring-red-500" value={form.fabrica} onChange={(e) => setForm({...form, fabrica: e.target.value})} disabled={!!editingAvaria}>
                    <option value="">Selecione...</option>
                    {FABRICAS.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Responsável</label>
                  <Input placeholder="Seu nome..." value={form.responsavel} onChange={(e) => setForm({...form, responsavel: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">SKU / REF <span className="text-red-500">*</span></label>
                  <Input placeholder="Ex: 12345" value={form.ref} onChange={(e) => setForm({...form, ref: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Quantidade <span className="text-red-500">*</span></label>
                  <Input type="number" min="1" value={form.qtde} onChange={(e) => setForm({...form, qtde: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição do Produto</label>
                  <Input placeholder="Nome do produto..." value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">NF de Entrada</label>
                  <Input placeholder="Opcional" value={form.nfEntrada} onChange={(e) => setForm({...form, nfEntrada: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Motivo da Avaria</label>
                  <textarea className="w-full min-h-[80px] rounded-md border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-red-500" value={form.motivo} onChange={(e) => setForm({...form, motivo: e.target.value})} />
                </div>
              </div>

              {editingAvaria && (
                <>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mt-8 mb-4 border-t pt-6">Logística e Tratativa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-5 rounded-xl border border-slate-200">
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Tratativa Externa</label>
                      <select className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs" value={form.tratativa} onChange={(e) => setForm({...form, tratativa: e.target.value})}>
                        <option value="PENDENTE">Pendente</option>
                        <option value="AGUARDANDO COLETA">Aguardando Coleta</option>
                        <option value="EM PROCESSO">Em Processo</option>
                        <option value="CONCLUÍDA">Concluída</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Status Interno</label>
                      <Input className="h-9 text-xs" value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Data da Coleta</label>
                      <Input className="h-9 text-xs" value={form.dataColeta} onChange={(e) => setForm({...form, dataColeta: e.target.value})} placeholder="DD/MM/AAAA" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Consta Fisicamente?</label>
                      <select className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs" value={form.constaFisicamente} onChange={(e) => setForm({...form, constaFisicamente: e.target.value})}>
                        <option value="SIM">SIM</option>
                        <option value="NÃO">NÃO</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Lançado no Sistema?</label>
                      <select className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs" value={form.lancadoSistema} onChange={(e) => setForm({...form, lancadoSistema: e.target.value})}>
                        <option value="SIM">SIM</option>
                        <option value="NÃO">NÃO</option>
                      </select>
                    </div>

                    <div className="col-span-full grid grid-cols-2 gap-5 mt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">NF de Saída</label>
                        <Input className="h-9 text-xs" value={form.nfSaida} onChange={(e) => setForm({...form, nfSaida: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">NF de Reposição</label>
                        <Input className="h-9 text-xs" value={form.nfReposicao} onChange={(e) => setForm({...form, nfReposicao: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
              <button onClick={fecharModais} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSalvarClicked} className={`flex items-center gap-2 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md transition-colors ${editingAvaria ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {editingAvaria ? <Save size={16} /> : <Plus size={16} />}
                {editingAvaria ? "Salvar Alterações" : "Registrar Nova Avaria"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔒 MODAL DA SENHA DE GERENTE */}
      {pinModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-700">
              <Lock size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">Acesso Restrito</h3>
            <p className="text-sm text-slate-500 mb-6">
              {pinModal.action === 'delete' 
                ? "Digite a Senha de Gerente para confirmar a exclusão permanente." 
                : "Digite a Senha de Gerente para autorizar a modificação."}
            </p>
            
            <Input 
              type="password" 
              placeholder="Digite o PIN numérico..." 
              className="text-center text-lg tracking-widest font-bold mb-6"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && executarAcaoComPin()}
            />

            <div className="flex gap-3">
              <button onClick={() => setPinModal({ isOpen: false, action: null })} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
              <button 
                onClick={executarAcaoComPin} 
                disabled={mutationDelete.isPending || mutationEdit.isPending}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white shadow-md flex items-center justify-center gap-2 ${pinModal.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {(mutationDelete.isPending || mutationEdit.isPending) ? <RefreshCw size={16} className="animate-spin"/> : <CheckCircle2 size={16} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}