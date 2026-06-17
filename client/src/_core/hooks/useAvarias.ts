import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useAvarias(urlPlanilha: string) {
  const isVinculado = !!urlPlanilha;

  const queryAvarias = trpc.notifications.getLiveData.useQuery(
    { url: urlPlanilha, mode: 'avarias' },
    { enabled: isVinculado }
  );

  const utils = trpc.useContext();

  const mutationAdd = trpc.notifications.addAvaria.useMutation({
    onSuccess: () => {
      toast.success("AVARIA REGISTRADA COM SUCESSO!");
      utils.notifications.getLiveData.invalidate();
    },
    onError: (err) => toast.error("ERRO AO SALVAR: " + err.message)
  });

  const mutationEdit = trpc.notifications.editAvariaFull.useMutation({
    onSuccess: () => {
      toast.success("AVARIA ATUALIZADA COM SUCESSO!");
      utils.notifications.getLiveData.invalidate();
    },
    onError: (err) => toast.error("ERRO NA EDIÇÃO: " + err.message)
  });

  const mutationDelete = trpc.notifications.deleteAvariaRow.useMutation({
    onSuccess: () => {
      toast.success("AVARIA EXCLUÍDA PERMANENTEMENTE.");
      utils.notifications.getLiveData.invalidate();
    },
    onError: (err) => toast.error("ERRO AO EXCLUIR: " + err.message)
  });

  return {
    avarias: queryAvarias.data || [],
    isFetching: queryAvarias.isFetching,
    refetch: queryAvarias.refetch,
    addAvaria: mutationAdd.mutate,
    isAdding: mutationAdd.isPending,
    editAvaria: mutationEdit.mutate,
    isEditing: mutationEdit.isPending,
    deleteAvaria: mutationDelete.mutate,
    isDeleting: mutationDelete.isPending
  };
}
