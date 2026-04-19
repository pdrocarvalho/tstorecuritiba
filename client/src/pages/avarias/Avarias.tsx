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
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);

  // 🚀 MODO AVARIAS ATIVADO
  const { data: todasAvarias = [], refetch } = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'avarias' }, 
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
            th { background: #f4f4f4; }
            .badge { padding: 2px 5px; border-radius: 3px; border: 1px solid #ccc; font-size: 10px; }
          </style>
        </head>
        <body>
          <h2>Relatório de Gestão de Avarias</h2>
          <p>Filtros: ${filtrosAtivos.length > 0 ? filtrosAtivos.join(", ") : "Geral"}</p>
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
                  <td><span class="badge">${av.TRATATIVA || "PENDENTE"}</span></td>
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
    setIsSincronizando(true);
    const result = await refetch();
    if (!result.isError) setIsVinculado(true);
    setIsSincronizando(false);
  };

  const [form, setForm] = useState({ fabrica: "", ref: "", descricao: "", qtde: "1", nfEntrada: "", motivo: "", responsavel: "", status: "PENDENTE" });

  const handleSalvar = async () => {
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Campos obrigatórios faltando.");
    const codAvaria = "GERANDO..."; // A lógica de código será processada no robô ou aqui
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
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg font-bold"><Printer size={18}/> Imprimir</button>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg"><Plus size={20}/> Nova Avaria</button>
            </div>
          )}
        </div>

        <Card className="p-4 border-red-100 bg-red-50/30 flex gap-4 items-center">
          <Input placeholder="Link do Google Sheets..." value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white flex-1" />
          {!isVinculado ? (
            <button onClick={handleVincular} disabled={isSincronizando} className="bg-red-600 text-white px-8 py-2 rounded-lg font-bold">Vincular</button>
          ) : (
            <button onClick={() => refetch()} className="bg-white border border-emerald-200 text-emerald-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2">
              <RefreshCw size={18} className={isSincronizando ? "animate-spin" : ""} /> Atualizar
            </button>
          )}
        </Card>

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200 shadow-xl rounded-xl">
            <div className="p-5 border-b bg-slate-50/50 flex flex-col lg:flex-row justify-between gap-4">
              <Input placeholder="Buscar por REF ou Código..." className="w-full lg:w-96 pl-10" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => toggleFiltro(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${filtrosAtivos.includes(s.id) ? `bg-${s.color}-600 text-white border-${s.color}-700` : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-400 text-[10px] font-black uppercase border-b">
                <tr><th className="px-6 py-4 w-10"></th><th className="px-4">Cód.</th><th className="px-4">REF</th><th className="px-4 w-1/3">Descrição</th><th className="px-4 text-center">Qtde</th><th className="px-4">NF Entrada</th><th className="px-6 text-right">Tratativa</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {avariasFiltradas.map((av: any, idx: number) => {
                  const isExpanded = expandedRow === idx;
                  const style = getTratativaStyle(av.TRATATIVA);
                  return (
                    <React.Fragment key={idx}>
                      <tr onClick={() => setExpandedRow(isExpanded ? null : idx)} className="cursor-pointer hover:bg-slate-50 transition-all">
                        <td className="px-6 py-5">{isExpanded ? <ChevronUp size={18} className="text-red-500"/> : <ChevronDown size={18}/>}</td>
                        <td className="px-4 font-bold">{av.COD__AVARIA}</td>
                        <td className="px-4"><span className="bg-slate-100 px-2 py-1 rounded font-mono text-xs">{av.REF_}</span></td>
                        <td className="px-4 text-slate-600">{av.DESCRICAO}</td>
                        <td className="px-4 text-center font-black text-red-600">{av.QTDE_}</td>
                        <td className="px-4">{av.NOTA_FISCAL_DE_ENTRADA}</td>
                        <td className="px-6 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${style.class}`}>
                            {style.icon} {av.TRATATIVA || 'PENDENTE'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="px-10 py-6">
                            <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Motivo</p><p className="text-xs italic bg-white p-2 border rounded mt-1">{av.MOTIVO}</p></div>
                              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Responsável</p><p className="font-semibold">{av.RESPONSAVEL}</p></div>
                              <div className="bg-white p-3 border rounded">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Status Interno</p><p className="text-xs font-black">{av.STATUS || 'PENDENTE'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Coleta</p><p className="text-xs">{av.DATA_DA_COLETA || '-'}</p>
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
          </Card>
        )}
      </div>
    </MainLayout>
  );
}