import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function ConflictModal({ 
  conflitos, 
  urlDemandas, 
  onResolved 
}: { 
  conflitos: any[]; 
  urlDemandas: string;
  onResolved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [resolutions, setResolutions] = useState<any[]>([]);

  const resolverMutation = trpc.notifications.resolverConflitosLogistica.useMutation({
    onSuccess: () => {
      toast.success("Conflitos resolvidos e planilhas atualizadas!");
      onResolved();
    },
    onError: (err) => {
      toast.error("Erro ao resolver conflitos: " + err.message);
    }
  });

  if (!conflitos || conflitos.length === 0) return null;

  const currentConflict = conflitos[step];

  const handleResolve = () => {
    // Collect selected demands
    const form = document.getElementById("conflict-form") as HTMLFormElement;
    if (!form) return;

    const formData = new FormData(form);
    const selectedIndexes = formData.getAll("demanda").map(i => parseInt(i as string));

    if (selectedIndexes.length === 0) {
      toast.warning("Selecione pelo menos uma demanda para priorizar.");
      return;
    }

    const ship = currentConflict.cargas[0]; // simplistic approach, takes first available shipment
    if (!ship) return;

    const newResolutions = selectedIndexes.map(index => {
      const dem = currentConflict.demandas[index];
      
      const status = ship.dataEntrega && ship.dataEntrega !== "-" ? "CHEGOU" : 
                     (ship.previsao && ship.previsao !== "-" ? "PREVISÃO" : "FATURADA");

      const payloadWebhook = {
        tipoDemanda: dem.isVenda ? "VENDA FUTURA" : "ALERTA DE DEMANDA",
        consultor: dem.consultor,
        cliente: dem.cliente,
        contato: dem.contato,
        referencia: dem.referencia,
        status: status,
        ehNovoRegistro: !dem.threadId,
        statusMudou: true,
        statusAnterior: String(dem.status).toUpperCase(),
        threadId: dem.threadId || "",
        dadosCarga: {
            descricao: ship.descricao,
            nf: ship.nf,
            fornecedor: ship.fornecedor,
            transportadora: ship.transportadora,
            volumes: ship.volumes,
            dataEmbarque: ship.dataEmbarque ? ship.dataEmbarque.toLocaleDateString('pt-BR') : "-",
            previsao: ship.previsao || "-",
            dataEntrega: ship.dataEntrega || "-"
        },
        aba: dem.aba,
        rowNumber: dem.originalIndex
      };

      return {
        aba: dem.aba,
        rowNumber: dem.originalIndex,
        newStatus: status,
        payloadWebhook
      };
    });

    const updatedResolutions = [...resolutions, ...newResolutions];
    
    if (step + 1 < conflitos.length) {
      setResolutions(updatedResolutions);
      setStep(step + 1);
    } else {
      resolverMutation.mutate({ urlDemandas, resolucoes: updatedResolutions });
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="bg-[#0D1526] text-white border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-amber-500">
            <AlertTriangle />
            Conflito de Estoque Detectado!
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Temos menos quantidade a caminho do que o solicitado pelas demandas abaixo.
            Passo {step + 1} de {conflitos.length}.
          </DialogDescription>
        </DialogHeader>

        {currentConflict && (
          <div className="space-y-6 mt-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-amber-500">REFERÊNCIA</p>
                <p className="text-xl font-black font-mono">{currentConflict.ref}</p>
                <p className="text-xs text-white/50 mt-1">Tipo: {currentConflict.tipo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-500">OFERTA DISPONÍVEL</p>
                <p className="text-3xl font-black flex items-center justify-end gap-2 text-white">
                  <Package size={24} /> {currentConflict.ofertaDisponivel}
                </p>
              </div>
            </div>

            <form id="conflict-form" className="space-y-4">
              <p className="text-sm font-bold text-white/60 uppercase">Escolha quem vai receber a alocação:</p>
              {currentConflict.demandas.map((d: any, index: number) => (
                <label key={index} className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-black/20 hover:bg-black/40 cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    name="demanda" 
                    value={index}
                    className="mt-1 w-5 h-5 rounded border-white/20 bg-black/50 text-brand-secondary focus:ring-brand-secondary/50" 
                  />
                  <div className="flex-1">
                    <p className="font-bold text-white text-lg">{d.cliente}</p>
                    <p className="text-sm text-white/50">Consultor: {d.consultor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40 uppercase font-bold">Solicitado</p>
                    <p className="text-xl font-bold font-mono text-blue-400">{d.quantidade || 1}</p>
                  </div>
                </label>
              ))}
            </form>

            <div className="pt-4 flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (step + 1 < conflitos.length) setStep(step + 1);
                  else onResolved();
                }}
                disabled={resolverMutation.isPending}
                className="border-white/10 text-white hover:bg-white/5"
              >
                Pular
              </Button>
              <Button 
                onClick={handleResolve}
                disabled={resolverMutation.isPending}
                className="bg-brand-secondary hover:bg-blue-600 text-white font-bold px-8"
              >
                {resolverMutation.isPending ? "Salvando..." : (step + 1 === conflitos.length ? "Finalizar Resolução" : "Próximo")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
