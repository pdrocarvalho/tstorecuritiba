/**
 * client/src/pages/avarias/Avarias.tsx
 */
import { useState, useMemo } from "react";
import { 
  Plus, Search, RefreshCw, Link2, X, AlertOctagon, 
  CheckCircle2, Clock, Truck, ClipboardList, Filter 
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
      toast.success("Avaria registada com sucesso!");
      setShowModal(false);
      refetch();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

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
    if (!form.fabrica || !form.ref || !form.qtde) return toast.warning("Preencha os campos obrigatórios.");
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Avarias</h1>
            <p className="text-gray-600">Controle de entradas e tratativas</p>
          </div>
          {isVinculado && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg">
              <Plus size={20} /> Nova Avaria
            </button>
          )}
        </div>

        <Card className="p-4 border-red-100 bg-red-50/30 flex gap-4 items-center">
          <div className="flex-1">
            <span className="text-xs font-bold text-red-800 uppercase block mb-1">Link da Planilha</span>
            <Input placeholder="Cole o link..." value={urlPlanilha} onChange={(e) => setUrlPlanilha(e.target.value)} disabled={isVinculado} className="bg-white" />
          </div>
          <div className="pt-5">
            {!isVinculado ? (
              <button onClick={() => { setIsSincronizando(true); refetch().then(() => setIsVinculado(true)); }} className="bg-red-600 text-white px-6 py-2.5 rounded-md font-medium">Vincular</button>
            ) : (
              <button onClick={() => refetch()} className="bg-white border border-red-200 text-red-700 px-6 py-2.5 rounded-md font-medium">Atualizar</button>
            )}
          </div>
        </Card>

        {isVinculado && (
          <Card className="overflow-hidden border-slate-200">
             <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                <Input placeholder="Buscar por REF..." className="w-72 bg-white" value={filtroSku} onChange={(e) => setFiltroSku(e.target.value)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-slate-500 text-xs uppercase border-b">
                    <tr>
                      <th className="px-4 py-3">Cód. Avaria</th>
                      <th className="px-4 py-3">REF</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3 text-center">Qtde</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {avariasFiltradas.map((av: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold">{av.COD__AVARIA}</td>
                        <td className="px-4 py-3 font-mono text-xs">{av.REF_}</td>
                        <td className="px-4 py-3 text-slate-700">{av.DESCRICAO}</td>
                        <td className="px-4 py-3 text-center font-bold">{av.QTDE_}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${av.STATUS === 'PENDENTE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {av.STATUS}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="w-full max-w-md bg-white h-full p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold">Novo Registro</h2>
                <button onClick={() => setShowModal(false)}><X /></button>
              </div>
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Fábrica *</label>
                <select className="w-full border p-2 rounded-md" value={form.fabrica} onChange={(e) => setForm({...form, fabrica: e.target.value})}>
                  <option value="">Selecione...</option>
                  {FABRICAS.map(f => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                </select>
                <label className="block text-xs font-bold text-slate-500 uppercase">REF *</label>
                <Input value={form.ref} onChange={(e) => setForm({...form, ref: e.target.value})} />
                <label className="block text-xs font-bold text-slate-500 uppercase">Quantidade *</label>
                <Input type="number" value={form.qtde} onChange={(e) => setForm({...form, qtde: e.target.value})} />
                <label className="block text-xs font-bold text-slate-500 uppercase">Descrição</label>
                <Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} />
                <button onClick={handleSalvar} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold mt-6">Salvar no Google Sheets</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}