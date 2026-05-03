/**
 * client/src/pages/avarias/Avarias.tsx
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, Search, RefreshCw, X, AlertOctagon, 
  CheckCircle2, Truck, ChevronDown, ChevronUp, Tag, PackageCheck, 
  HelpCircle, Printer, Save, Edit, Trash2, Lock
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";

const FABRICAS = [
  { nome: "CUTELARIA", prefixo: "CTL" },
  { nome: "FARROUPILHA", prefixo: "FRP" },
  { nome: "CD SUL", prefixo: "CDS" },
  { nome: "TEEC", prefixo: "TEC" },
  { nome: "BELÉM", prefixo: "BLM" }
];

const STATUS_OPTIONS = [
  { id: "PENDENTE", label: "PENDENTE", color: "red" },
  { id: "EM PROCESSO", label: "EM PROCESSO", color: "blue" }, // 🚀 ALTERADO PARA BLUE (#2563eb)
  { id: "CONCLUÍDA", label: "CONCLUÍDA", color: "emerald" },
];

const MOTIVO_OPTIONS = [
  "ACIDENTE",
  "QUEBRADO",
  "MAU USO",
  "PROBLEMA TÉCNICO"
];

const OPERACIONAL_OPTIONS = [
  "AGUARDANDO TRATATIVA",
  "AGUARDANDO COLETA",
  "AGUARDANDO REPOSIÇÃO",
  "AGUARDANDO AJUSTE DE ESTOQUE",
  "FINALIZADO"
];

const FORM_VAZIO = {
  fabrica: "", ref: "", descricao: "", qtde: "1", nfEntrada: "", motivo: "ACIDENTE", responsavel: "", 
  tratativa: "PENDENTE", status: "AGUARDANDO TRATATIVA", constaFisicamente: "SIM", lancadoSistema: "NÃO",
  nfSaida: "", nfReposicao: "", dataColeta: "", cupomFiscal: "", observacoes: ""
};

export default function GestaoAvarias() {
  const [urlPlanilha] = useState(() => localStorage.getItem("url_avarias") || "");
  const isVinculado = !!urlPlanilha;

  const [showModal, setShowModal] = useState(false);
  const [filtroSku, setFiltroSku] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);

  const [editingAvaria, setEditingAvaria] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  
  const [pinModal, setPinModal] = useState<{ isOpen: boolean, action: 'edit' | 'delete' | null, avariaTarget?: any }>({ isOpen: false, action: null });
  const [pinValue, setPinValue] = useState("");

  const { data: todasAvarias = [], refetch, isFetching } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'avarias' }, 
    { enabled: isVinculado }
  );

  const formatUpper = (val: string) => String(val || "").toUpperCase();

  const mutationAdd = trpc.notifications.addAvaria.useMutation({
    onSuccess: () => {
      toast.success("AVARIA REGISTRADA COM SUCESSO!");
      fecharModais();
      refetch();
    },
    onError: (err) => toast.error("ERRO AO SALVAR: " + err.message)
  });

  const mutationEdit = trpc.notifications.editAvariaFull.useMutation({
    onSuccess: () => {
      toast.success("AVARIA ATUALIZADA COM SUCESSO!");
      fecharModais();
      refetch();
    },
    onError: (err) => toast.error("ERRO NA EDIÇÃO: " + err.message)
  });

  const mutationDelete = trpc.notifications.deleteAvariaRow.useMutation({
    onSuccess: () => {
      toast.success("AVARIA EXCLUÍDA PERMANENTEMENTE.");
      fecharModais();
      refetch();
    },
    onError: (err) => toast.error("ERRO AO EXCLUIR: " + err.message)
  });

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
      fabrica: formatUpper(av.FABRICA),
      ref: formatUpper(av.REF),
      descricao: formatUpper(av.DESCRICAO || av.DESCRIÇÃO),
      qtde: av.QTDE || "1",
      nfEntrada: formatUpper(av.NOTA_FISCAL_DE_ENTRADA),
      cupomFiscal: formatUpper(av.CUPOM_FISCAL),
      motivo: formatUpper(av.MOTIVO) || "ACIDENTE",
      responsavel: formatUpper(av.RESPONSAVEL || av.RESPONSÁVEL),
      tratativa: formatUpper(av.TRATATIVA) || "PENDENTE",
      status: formatUpper(av.STATUS) || "AGUARDANDO TRATATIVA",
      constaFisicamente: formatUpper(av.CONSTA_FISICAMENTE) || "SIM",
      lancadoSistema: formatUpper(av.FOI_LANCADO_NO_SISTEMA) || "NÃO",
      nfSaida: formatUpper(av.NOTA_FISCAL_DE_SAIDA),
      nfReposicao: formatUpper(av.NOTA_FISCAL_DE_REPOSICAO),
      dataColeta: formatUpper(av.DATA_DA_COLETA),
      observacoes: formatUpper(av.OBSERVACOES || av.OBSERVAÇÃO || "") 
    });
    setShowModal(true);
  };

  const handleSalvarClicked = () => {
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("CAMPOS OBRIGATÓRIOS FALTANDO.");
    
    if (editingAvaria) {
      setPinModal({ isOpen: true, action: 'edit' });
    } else {
      const fabricaObj = FABRICAS.find(f => f.nome === form.fabrica);
      const prefixo = fabricaObj?.prefixo || "AVR";
      const codigosExistentes = todasAvarias.map((a: any) => String(a.COD_AVARIA || "")).filter((c: string) => c.startsWith(prefixo));
      const proximoNumero = codigosExistentes.length > 0 ? Math.max(...codigosExistentes.map(c => parseInt(c.replace(/[^\d]/g, ""), 10) || 0)) + 1 : 1;
      const codAvaria = `${prefixo}${String(proximoNumero).padStart(4, '0')}`;
      
      const novaLinha = [
        new Date().toLocaleDateString('pt-BR'), form.fabrica, codAvaria, form.ref, form.descricao, 
        form.qtde, form.nfEntrada, form.cupomFiscal, form.motivo, form.responsavel, 
        form.lancadoSistema, form.tratativa, form.constaFisicamente, form.dataColeta, 
        form.nfSaida, form.nfReposicao, form.status, 
        "", // R (Controle)
        form.observacoes // S
      ];
      mutationAdd.mutate({ url: urlPlanilha, row: novaLinha.map(v => typeof v === 'string' ? v.toUpperCase() : v) });
    }
  };

  const executarAcaoComPin = () => {
    if (!pinValue) return toast.warning("DIGITE A SENHA DE GERENTE.");

    if (pinModal.action === 'delete' && pinModal.avariaTarget) {
      mutationDelete.mutate({ url: urlPlanilha, rowNumber: pinModal.avariaTarget.rowNumber, pin: pinValue });
    } 
    else if (pinModal.action === 'edit' && editingAvaria) {
      const linhaAtualizada = [
        editingAvaria.DATA_DE_ENTRADA || "", form.fabrica, editingAvaria.COD_AVARIA || "", 
        form.ref, form.descricao, form.qtde, form.nfEntrada, form.cupomFiscal, 
        form.motivo, form.responsavel, form.lancadoSistema, form.tratativa, 
        form.constaFisicamente, form.dataColeta, form.nfSaida, form.nfReposicao, form.status,
        editingAvaria.OK_STATUS || "", // R
        form.observacoes // S
      ];
      mutationEdit.mutate({ 
        url: urlPlanilha, 
        rowNumber: editingAvaria.rowNumber, 
        row: linhaAtualizada.map(v => typeof v === 'string' ? v.toUpperCase() : v), 
        pin: pinValue 
      });
    }
  };

  const getTratativaStyle = (texto: string) => {
    const t = formatUpper(texto);
    if (t === "PENDENTE") return { class: "bg-red-100 text-red-700 border-red-300", icon: <AlertOctagon size={10}/> };
    if (t === "EM PROCESSO") return { class: "bg-blue-100 text-[#2563eb] border-blue-300", icon: <Truck size={10}/> }; // 🚀 COR AZUL
    if (t === "CONCLUÍDA") return { class: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <PackageCheck size={10}/> };
    return { class: "bg-slate-100 text-slate-500 border-slate-200", icon: <HelpCircle size={10}/> };
  };

  const toggleFiltro = (statusId: string) => {
    setFiltrosAtivos(prev => 
      prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]
    );
  };

  const avariasFiltradas = useMemo(() => {
    return todasAvarias.filter((a: any) => {
      const search = filtroSku.toLowerCase();
      const refValue = String(a.REF || "").toLowerCase();
      const codValue = String(a.COD_AVARIA || "").toLowerCase();
      const matchesSearch = !filtroSku || refValue.includes(search) || codValue.includes(search);
      const tratativaRow = formatUpper(a.TRATATIVA || "PENDENTE");
      const matchesStatus = filtrosAtivos.length === 0 || filtrosAtivos.includes(tratativaRow);
      return matchesSearch && matchesStatus;
    });
  }, [todasAvarias, filtroSku, filtrosAtivos]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `
      <html><head><title>RELATÓRIO - T STORE</title><style>body { font-family: sans-serif; padding: 20px; font-size: 12px; text-transform: uppercase; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; }</style></head>
      <body><h2>GESTÃO DE AVARIAS</h2><table><thead><tr><th>CÓD.</th><th>REF</th><th>DESCRIÇÃO</th><th>QTD</th><th>STATUS</th><th>TRATATIVA</th></tr></thead>
      <tbody>${avariasFiltradas.map((av: any) => `<tr><td>${av.COD_AVARIA || ""}</td><td>${av.REF || ""}</td><td>${av.DESCRICAO || ""}</td><td>${av.QTDE || ""}</td><td>${av.STATUS || ""}</td><td>${av.TRATATIVA || ""}</td></tr>`).join("")}</tbody></table>
      <script>setTimeout(() => { window.print(); window.close(); }, 500);</script></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Gestão de Avarias</h1>
            <p className="text-slate-500 uppercase">Fluxo operacional de produtos danificados</p>
          </div>
          {isVinculado && (
            <div className="flex gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 shadow-sm transition-colors uppercase text-xs"><Printer size={18}/> Imprimir</button>
              <button onClick={() => refetch()} className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg font-bold hover:bg-emerald-50 shadow-sm transition-colors uppercase text-xs">
                <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} /> Atualizar
              </button>
              <button onClick={abrirModalNova} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg hover:bg-red-700 transition-colors uppercase text-xs"><Plus size={20}/> Nova Avaria</button>
            </div>
          )}
        </div>

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-xl">
            <div className="p-5 border-b bg-slate-50/50 flex flex-col lg:flex-row justify-between gap-4">
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input placeholder="BUSCAR POR REF OU CÓDIGO..." className="pl-10 bg-white uppercase" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value.toUpperCase())} />
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button 
                    key={s.id} onClick={() => toggleFiltro(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${filtrosAtivos.includes(s.id) ? (s.color === 'blue' ? 'bg-[#2563eb] text-white border-transparent' : `bg-${s.color}-600 text-white border-transparent`) : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase border-b">
                  <tr><th className="px-6 py-4 w-10"></th><th>CÓD.</th><th>REF</th><th>DESCRIÇÃO</th><th className="text-center">QTDE</th><th>STATUS (OPERACIONAL)</th><th className="text-right px-6">TRATATIVA</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {avariasFiltradas.map((av: any, idx: number) => {
                    const isExpanded = expandedRow === idx;
                    const style = getTratativaStyle(av.TRATATIVA);
                    return (
                      <React.Fragment key={idx}>
                        <tr onClick={() => setExpandedRow(isExpanded ? null : idx)} className={`cursor-pointer ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}>
                          <td className="px-6 py-5">{isExpanded ? <ChevronUp size={18} className="text-red-500"/> : <ChevronDown size={18}/>}</td>
                          <td className="font-bold uppercase">{av.COD_AVARIA || '-'}</td>
                          <td><span className="bg-slate-100 px-2 py-1 rounded font-mono text-xs uppercase">{av.REF || '-'}</span></td>
                          <td className="font-medium text-slate-700 uppercase">{av.DESCRICAO || '-'}</td>
                          <td className="text-center font-black text-red-600 uppercase">{av.QTDE || '-'}</td>
                          <td><span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase">{av.STATUS || 'AGUARDANDO'}</span></td>
                          <td className="text-right px-6">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border shadow-sm ${style.class}`}>
                              {style.icon} {formatUpper(av.TRATATIVA) || 'PENDENTE'}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="px-10 py-8 relative">
                              <div className="absolute top-4 right-10 flex gap-2">
                                <button onClick={() => abrirModalEdicao(av)} className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm uppercase"><Edit size={14} /> EDITAR</button>
                                <button onClick={() => setPinModal({ isOpen: true, action: 'delete', avariaTarget: av })} className="flex items-center gap-1.5 bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm uppercase"><Trash2 size={14} /> EXCLUIR</button>
                              </div>
                              <div className="grid grid-cols-3 gap-8 mt-4 uppercase">
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-black text-slate-400 border-b pb-1">LOGÍSTICA</h4>
                                  <p className="text-xs text-slate-600"><strong>DATA COLETA:</strong> {av.DATA_DA_COLETA || '-'}</p>
                                  <p className="text-xs text-slate-600"><strong>NF SAÍDA:</strong> {av.NOTA_FISCAL_DE_SAIDA || '-'}</p>
                                  <p className="text-xs text-slate-600"><strong>NF REPOSIÇÃO:</strong> {av.NOTA_FISCAL_DE_REPOSICAO || '-'}</p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-black text-slate-400 border-b pb-1">IDENTIFICAÇÃO</h4>
                                  <p className="text-xs text-slate-600"><strong>RESPONSÁVEL:</strong> {av.RESPONSAVEL || '-'}</p>
                                  <p className="text-xs text-slate-600"><strong>ENTRADA:</strong> {av.DATA_DE_ENTRADA || '-'}</p>
                                  <p className="text-xs text-slate-600"><strong>MOTIVO:</strong> {av.MOTIVO || '-'}</p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-[10px] font-black text-slate-400 border-b pb-1">OBSERVAÇÕES</h4>
                                  <p className="text-[10px] text-slate-600 italic bg-white p-2 rounded border border-slate-100 min-h-[40px] whitespace-pre-wrap">{av.OBSERVACOES || 'SEM OBSERVAÇÕES ADICIONAIS.'}</p>
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

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              {/* 🚀 TÍTULO DINÂMICO COM CÓDIGO DA AVARIA */}
              <h2 className="font-bold text-lg uppercase">
                {editingAvaria ? `EDITAR AVARIA - ${editingAvaria.COD_AVARIA || editingAvaria.COD__AVARIA}` : "REGISTRAR NOVA AVARIA"}
              </h2>
              <button onClick={fecharModais} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">FÁBRICA *</label>
                  <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm uppercase" value={form.fabrica} onChange={(e) => setForm({...form, fabrica: e.target.value.toUpperCase()})}>
                    <option value="">SELECIONE...</option>
                    {FABRICAS.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">RESPONSÁVEL</label>
                  <Input value={form.responsavel} onChange={(e) => setForm({...form, responsavel: e.target.value.toUpperCase()})} className="uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">REF *</label>
                  <Input value={form.ref} onChange={(e) => setForm({...form, ref: e.target.value.toUpperCase()})} className="uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">QTDE *</label>
                  <Input type="number" value={form.qtde} onChange={(e) => setForm({...form, qtde: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">DESCRIÇÃO</label>
                <Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value.toUpperCase()})} className="uppercase" />
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">NF ENTRADA</label>
                  <Input value={form.nfEntrada} onChange={(e) => setForm({...form, nfEntrada: e.target.value.toUpperCase()})} className="uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">CUPOM FISCAL</label>
                  <Input value={form.cupomFiscal} onChange={(e) => setForm({...form, cupomFiscal: e.target.value.toUpperCase()})} className="uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">MOTIVO *</label>
                  <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm uppercase" value={form.motivo} onChange={(e) => setForm({...form, motivo: e.target.value.toUpperCase()})}>
                    {MOTIVO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">OBSERVAÇÕES DETALHADAS</label>
                <textarea 
                   className="w-full min-h-[80px] rounded-md border border-slate-200 p-3 text-sm uppercase focus:ring-2 focus:ring-[#2563eb] outline-none" 
                   value={form.observacoes} 
                   onChange={(e) => setForm({...form, observacoes: e.target.value.toUpperCase()})} 
                   placeholder="DETALHE O OCORRIDO AQUI..."
                />
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">CONTROLE OPERACIONAL</h4>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">TRATATIVA (MACRO)</label>
                    <select className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs uppercase font-bold" value={form.tratativa} onChange={(e) => setForm({...form, tratativa: e.target.value.toUpperCase()})}>
                      {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">STATUS OPERACIONAL (COLUNA Q)</label>
                    <select className="w-full h-9 rounded-md border border-slate-200 px-2 text-xs font-bold text-[#2563eb] uppercase" value={form.status} onChange={(e) => setForm({...form, status: e.target.value.toUpperCase()})}>
                      {OPERACIONAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">DATA COLETA</label>
                    <Input className="h-9 text-xs uppercase" value={form.dataColeta} onChange={(e) => setForm({...form, dataColeta: e.target.value.toUpperCase()})} placeholder="DD/MM/AAAA" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">NF SAÍDA</label>
                    <Input className="h-9 text-xs uppercase" value={form.nfSaida} onChange={(e) => setForm({...form, nfSaida: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">NF REPOSIÇÃO</label>
                    <Input className="h-9 text-xs uppercase" value={form.nfReposicao} onChange={(e) => setForm({...form, nfReposicao: e.target.value.toUpperCase()})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50 sticky bottom-0">
              <button onClick={fecharModais} className="px-4 py-2 text-sm font-bold text-slate-600 uppercase">CANCELAR</button>
              <button onClick={handleSalvarClicked} className={`flex items-center gap-2 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md uppercase ${editingAvaria ? 'bg-[#2563eb]' : 'bg-red-600'}`}>
                <Save size={16} /> {editingAvaria ? "SALVAR ALTERAÇÕES" : "REGISTRAR AVARIA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pinModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
            <Lock size={24} className="mx-auto mb-4 text-slate-700" />
            <h3 className="text-lg font-black mb-6 uppercase">DIGITE A SENHA DE GERENTE</h3>
            <Input type="password" value={pinValue} onChange={(e) => setPinValue(e.target.value)} className="text-center text-lg font-bold mb-6 uppercase" autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setPinModal({ isOpen: false, action: null })} className="flex-1 py-2 bg-slate-100 rounded-lg uppercase text-xs font-bold">CANCELAR</button>
              <button onClick={executarAcaoComPin} className="flex-1 py-2 bg-[#2563eb] text-white rounded-lg uppercase text-xs font-bold">CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}