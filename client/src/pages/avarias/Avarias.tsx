/**
 * client/src/pages/avarias/Avarias.tsx
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, Search, RefreshCw, Link2, X, AlertOctagon, 
  CheckCircle2, Clock, Truck, TableProperties, 
  ChevronDown, ChevronUp, Info, Tag, Timer, PackageCheck, 
  HelpCircle, Printer, Filter
} from "lucide-react"; // 🚀 CORRIGIDO: lucide-react
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

const STATUS_OPTIONS = [
  { id: "PENDENTE", label: "Pendente", color: "red" },
  { id: "AGUARDANDO COLETA", label: "Aguardando Coleta", color: "blue" },
  { id: "EM PROCESSO", label: "Em Processo", color: "amber" },
  { id: "CONCLUÍDA", label: "Concluída", color: "emerald" },
];

export default function GestaoAvarias() {
  // 🚀 PERSISTÊNCIA: Inicializa estados buscando no sessionStorage
  const [urlPlanilha, setUrlPlanilha] = useState(() => {
    return sessionStorage.getItem("url_avarias") || "";
  });

  const [isVinculado, setIsVinculado] = useState(() => {
    return sessionStorage.getItem("vinculado_avarias") === "true";
  });

  const [isSincronizando, setIsSincronizando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filtroSku, setFiltroSku] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);

  // 🚀 QUERY: Habilitada automaticamente se já houver URL e status de vinculado
  const { data: todasAvarias = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'avarias' }, 
    { enabled: isVinculado && !!urlPlanilha }
  );

  // 🚀 AUTO-REFETCH: Garante que os dados carreguem ao trocar de aba
  useEffect(() => {
    if (isVinculado && urlPlanilha) {
      refetch();
    }
  }, []);

  const mutationAdd = trpc.notifications.addAvaria.useMutation({
    onSuccess: () => {
      toast.success("Avaria registrada com sucesso!");
      setShowModal(false);
      refetch();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

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
      const matchesSearch = !filtroSku || 
        String(a.REF_ || "").toLowerCase().includes(search) ||
        String(a.COD__AVARIA || "").toLowerCase().includes(search);

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
              ${avariasFiltradas.map(av => `
                <tr>
                  <td>${av.COD__AVARIA || ""}</td>
                  <td>${av.REF_ || ""}</td>
                  <td>${av.DESCRICAO || ""}</td>
                  <td>${av.QTDE_ || ""}</td>
                  <td>${av.NOTA_FISCAL_DE_ENTRADA || ""}</td>
                  <td>${av.TRATATIVA || "PENDENTE"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
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
      if (result.isError) {
        toast.error("Falha no acesso à planilha.");
      } else {
        setIsVinculado(true);
        sessionStorage.setItem("url_avarias", urlPlanilha);
        sessionStorage.setItem("vinculado_avarias", "true");
        toast.success("Avarias vinculadas!");
      }
    } catch (error) {
      toast.error("Erro de conexão.");
    } finally {
      setIsSincronizando(false);
    }
  };

  const handleCancelar = () => {
    setIsVinculado(false);
    setUrlPlanilha("");
    sessionStorage.removeItem("url_avarias");
    sessionStorage.removeItem("vinculado_avarias");
    setExpandedRow(null);
    setFiltrosAtivos([]);
    toast.info("Vínculo removido.");
  };

  const [form, setForm] = useState({ fabrica: "", ref: "", descricao: "", qtde: "1", nfEntrada: "", motivo: "", responsavel: "", status: "PENDENTE" });

  const handleSalvar = async () => {
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Campos obrigatórios faltando.");
    const fabrica = FABRICAS.find(f => f.nome === form.fabrica);
    const codigos = todasAvarias.map((a: any) => String(a.COD__AVARIA || "")).filter((c: string) => c.startsWith(fabrica?.prefixo || ""));
    const num = codigos.length > 0 ? Math.max(...codigos.map(c => parseInt(c.replace(/[^\d]/g, ""), 10) || 0)) + 1 : 1;
    const codAvaria = `${fabrica?.prefixo}${String(num).padStart(4, '0')}`;
    
    const novaLinha = [new Date().toLocaleDateString('pt-BR'), form.fabrica, codAvaria, form.ref, form.descricao, form.qtde, form.nfEntrada, form.motivo, form.responsavel, "NÃO", "PENDENTE", "SIM", "PENDENTE", "", "", ""];
    mutationAdd.mutate({ url: urlPlanilha, row: novaLinha });
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
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-50"><Printer size={18}/> Imprimir</button>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg"><Plus size={20}/> Nova Avaria</button>
            </div>
          )}
        </div>

        <Card className="p-4 border-red-100 bg-red-50/30 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <span className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1 block">Fonte de Dados</span>
            <Input 
              placeholder="Cole o link do Google Sheets..." 
              value={urlPlanilha} 
              onChange={(e) => setUrlPlanilha(e.target.value)} 
              disabled={isVinculado} 
              className="bg-white border-red-200 rounded-lg" 
            />
          </div>
          <div className="flex gap-2 pt-5 w-full md:w-auto">
            {!isVinculado ? (
              <button 
                onClick={handleVincular} 
                disabled={isSincronizando} 
                className="flex-1 bg-red-600 text-white px-8 py-2.5 rounded-lg font-bold shadow-md flex items-center justify-center gap-2"
              >
                {isSincronizando ? <RefreshCw className="animate-spin" size={18} /> : <Link2 size={18} />}
                {isSincronizando ? "Vinculando..." : "Vincular"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => refetch()} 
                  disabled={isSincronizando}
                  className="bg-white border border-emerald-200 text-emerald-700 px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-50 transition-colors"
                >
                  <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> 
                  {isSincronizando ? "Atualizando..." : "Atualizar"}
                </button>
                <button 
                  onClick={handleCancelar} 
                  className="p-2.5 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-200"
                  title="Desvincular"
                >
                  <X size={20}/>
                </button>
              </div>
            )}
          </div>
        </Card>

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-xl">
             <div className="p-5 border-b bg-slate-50/50 flex flex-col lg:flex-row justify-between gap-4">
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input placeholder="Buscar por REF ou Código..." className="pl-10" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value)} />
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
                          <td className="px-4 font-bold text-slate-900">{av.COD__AVARIA || '-'}</td>
                          <td className="px-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono text-xs">{av.REF_ || '-'}</span></td>
                          <td className="px-4 text-slate-700 font-medium">{av.DESCRICAO || '-'}</td>
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
                            <td colSpan={7} className="px-10 py-8">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Identificação</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Entrada</p><p className="font-semibold text-slate-700">{av.DATA_DE_ENTRADA || '-'}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Unidade</p><p className="font-semibold text-slate-700">{av.FABRICA || '-'}</p></div>
                                  </div>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Responsável</p><p className="font-semibold text-slate-700">{av.RESPONSAVEL || '-'}</p></div>
                                </div>
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Diagnóstico</h4>
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Motivo</p><p className="text-xs text-slate-700 italic bg-white p-3 rounded-lg border border-slate-200 mt-1">{av.MOTIVO || 'Não informado.'}</p></div>
                                  <div className="flex gap-3">
                                    <div className={`px-2 py-1 rounded text-[10px] font-black border ${av.CONSTA_FISICAMENTE_ === 'SIM' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>FÍSICO: {av.CONSTA_FISICAMENTE_ || '-'}</div>
                                    <div className={`px-2 py-1 rounded text-[10px] font-black border ${av.FOI_LANCADO_NO_SISTEMA_ === 'SIM' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>SISTEMA: {av.FOI_LANCADO_NO_SISTEMA_ || '-'}</div>
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
    </MainLayout>
  );
}