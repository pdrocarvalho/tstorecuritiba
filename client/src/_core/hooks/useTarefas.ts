/**
 * client/src/_core/hooks/useTarefas.ts
 * Hook para gerenciar tarefas (consultor e admin)
 */
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Hook para o consultor: suas tarefas do dia
 */
export function useMinhasTarefas(data: string) {
  const utils = trpc.useContext();

  const queryTasks = trpc.tasks.getMyTasks.useQuery(
    { data },
    { enabled: !!data }
  );

  const mutationComplete = trpc.tasks.completeTask.useMutation({
    onSuccess: () => {
      toast.success("Tarefa concluída!");
      utils.tasks.getMyTasks.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const mutationNotApplicable = trpc.tasks.markNotApplicable.useMutation({
    onSuccess: () => {
      toast.info("Tarefa marcada como não aplicável.");
      utils.tasks.getMyTasks.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  return {
    tarefas: queryTasks.data || [],
    isFetching: queryTasks.isFetching,
    refetch: queryTasks.refetch,
    concluirTarefa: mutationComplete.mutate,
    isConcluindo: mutationComplete.isPending,
    marcarNaoAplicavel: mutationNotApplicable.mutate,
  };
}

/**
 * Hook para o admin: todas as tarefas + CRUD de templates
 */
export function useTarefasAdmin() {
  const utils = trpc.useContext();

  // Templates
  const queryTemplates = trpc.tasks.getTemplates.useQuery();

  const mutationCreateTemplate = trpc.tasks.createTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template criado com sucesso!");
      utils.tasks.getTemplates.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const mutationUpdateTemplate = trpc.tasks.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template atualizado!");
      utils.tasks.getTemplates.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const mutationDeleteTemplate = trpc.tasks.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template desativado.");
      utils.tasks.getTemplates.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  // Tarefas avulsas
  const mutationCreateAdHoc = trpc.tasks.createAdHocTask.useMutation({
    onSuccess: () => {
      toast.success("Tarefa avulsa criada!");
      utils.tasks.getAllTasks.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  // Geração manual
  const mutationGenerate = trpc.tasks.generateDailyTasks.useMutation({
    onSuccess: () => {
      toast.success("Checklist do dia gerado com sucesso!");
      utils.tasks.getAllTasks.invalidate();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  return {
    templates: queryTemplates.data || [],
    isLoadingTemplates: queryTemplates.isFetching,
    createTemplate: mutationCreateTemplate.mutate,
    updateTemplate: mutationUpdateTemplate.mutate,
    deleteTemplate: mutationDeleteTemplate.mutate,
    createAdHocTask: mutationCreateAdHoc.mutate,
    generateDailyTasks: mutationGenerate.mutate,
    isGenerating: mutationGenerate.isPending,
  };
}

/**
 * Hook para buscar todas as tarefas com filtro de data (Admin)
 */
export function useAllTasks(startDate: string, endDate: string, userId?: number) {
  const queryAll = trpc.tasks.getAllTasks.useQuery(
    { startDate, endDate, userId },
    { enabled: !!startDate && !!endDate }
  );

  return {
    todasTarefas: queryAll.data || [],
    isFetching: queryAll.isFetching,
    refetch: queryAll.refetch,
  };
}
