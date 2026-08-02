/**
 * client/src/_core/hooks/useAvariaHistorico.ts
 *
 * Hook para buscar e registrar observações do histórico de uma avaria.
 */
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useAvariaHistorico(avariaId: number | null) {
  const query = trpc.notifications.getAvariaHistorico.useQuery(
    { avariaId: avariaId! },
    {
      enabled: !!avariaId && avariaId > 0,
      staleTime: 10_000,
    }
  );

  const mutation = trpc.notifications.addAvariaObservacao.useMutation({
    onSuccess: () => {
      toast.success("Observação registrada com sucesso!");
      query.refetch();
    },
    onError: (err) => {
      toast.error(`Erro ao registrar observação: ${err.message}`);
    },
  });

  return {
    historico: query.data ?? [],
    isFetching: query.isFetching,
    addObservacao: mutation.mutate,
    isAdding: mutation.isPending,
  };
}
