import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useDemandas(urlPlanilha?: string) {
  const isVinculado = !!urlPlanilha;

  const queryDemandas = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha || "", mode: 'demandas' },
    { enabled: isVinculado }
  );

  const utils = trpc.useContext();

  const mutationSave = trpc.notifications.saveDemanda.useMutation({
    onSuccess: () => {
      utils.notifications.getLiveData.invalidate();
    },
    onError: (err) => toast.error("ERRO AO SALVAR DEMANDA: " + err.message)
  });

  const mutationAutomacao = trpc.notifications.rodarAutomacaoDemandas.useMutation({
    onSuccess: () => toast.success("Automação rodou com sucesso!"),
    onError: (err) => toast.error("Falha na automação: " + err.message)
  });

  return {
    demandas: queryDemandas.data || [],
    isFetching: queryDemandas.isFetching,
    refetch: queryDemandas.refetch,
    saveDemanda: mutationSave.mutateAsync,
    isSaving: mutationSave.isPending,
    rodarAutomacao: mutationAutomacao.mutate,
    isRunningAutomacao: mutationAutomacao.isPending
  };
}
