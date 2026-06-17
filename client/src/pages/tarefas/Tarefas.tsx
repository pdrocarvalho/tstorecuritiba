/**
 * client/src/pages/tarefas/Tarefas.tsx
 * Sistema de Gestão de Tarefas — Visão Consultor + Admin
 */
import { useState, useMemo } from "react";
import {
  ClipboardCheck, CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, MessageSquare, Filter, Plus,
  RefreshCw, Sun, Moon, Package, Layers, HelpCircle,
  Settings2, X, Save
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMinhasTarefas, useTarefasAdmin, useAllTasks } from "@/_core/hooks/useTarefas";
import TemplateManager from "./components/TemplateManager";

const CATEGORY_CONFIG = {
  abertura: { label: "ABERTURA", icon: Sun, color: "from-amber-500/20 to-orange-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" },
  fechamento: { label: "FECHAMENTO", icon: Moon, color: "from-indigo-500/20 to-purple-500/10", border: "border-indigo-500/30", text: "text-indigo-400", badge: "bg-indigo-500/20 text-indigo-300" },
  estoque: { label: "ESTOQUE / ADM", icon: Package, color: "from-emerald-500/20 to-teal-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  geral: { label: "GERAL", icon: Layers, color: "from-sky-500/20 to-cyan-500/10", border: "border-sky-500/30", text: "text-sky-400", badge: "bg-sky-500/20 text-sky-300" },
};

type TaskData = {
  task: {
    id: number;
    titulo: string;
    descricao: string | null;
    categoria: "abertura" | "fechamento" | "estoque" | "geral";
    status: "pendente" | "concluida" | "nao_aplicavel";
    condicional: boolean;
    condicaoTexto: string | null;
    prioridade: "alta" | "media" | "baixa" | null;
    comentario: string | null;
    prazo: string | null;
  };
  atribuidoNome: string | null;
};

function getHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Tarefas() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const hoje = getHoje();

  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [comentarioAberto, setComentarioAberto] = useState<number | null>(null);
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Hooks
  const { tarefas, isFetching, concluirTarefa, isConcluindo, marcarNaoAplicavel } = useMinhasTarefas(dataSelecionada);
  const { isGenerating, generateDailyTasks } = useTarefasAdmin();

  // Agrupar tarefas por categoria
  const tarefasAgrupadas = useMemo(() => {
    const groups: Record<string, TaskData[]> = {};
    const lista = (tarefas as TaskData[]) || [];
    for (const item of lista) {
      const cat = item.task.categoria;
      if (categoriaFiltro && cat !== categoriaFiltro) continue;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [tarefas, categoriaFiltro]);

  // Progresso
  const totalTarefas = (tarefas as TaskData[]).length;
  const concluidas = (tarefas as TaskData[]).filter((t) => t.task.status === "concluida" || t.task.status === "nao_aplicavel").length;
  const porcentagem = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

  const handleConcluir = (taskId: number) => {
    if (comentarioAberto === taskId && comentarioTexto.trim()) {
      concluirTarefa({ taskId, comentario: comentarioTexto.trim() });
      setComentarioAberto(null);
      setComentarioTexto("");
    } else {
      concluirTarefa({ taskId });
    }
  };

  const handleToggleComentario = (taskId: number) => {
    if (comentarioAberto === taskId) {
      setComentarioAberto(null);
      setComentarioTexto("");
    } else {
      setComentarioAberto(taskId);
      setComentarioTexto("");
    }
  };

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ClipboardCheck className="text-brand-secondary" size={28} />
              CHECKLIST DO DIA
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {dataSelecionada === hoje ? "Hoje" : dataSelecionada} — {totalTarefas} tarefas
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <Button 
                  onClick={() => setIsManagerOpen(true)}
                  variant="outline" 
                  className="bg-black/20 border-white/10 text-white hover:bg-white/10"
                >
                  <Settings2 size={16} className="mr-2" />
                  Templates
                </Button>
                <Button 
                  onClick={() => generateDailyTasks({ data: dataSelecionada })}
                  disabled={isGenerating}
                  className="bg-brand-secondary text-black hover:bg-brand-secondary/80 font-bold"
                >
                  {isGenerating ? "Gerando..." : "Gerar Hoje"}
                </Button>
              </>
            )}
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="bg-glass border border-glass-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            />
          </div>
        </div>

        {/* Barra de Progresso */}
        {totalTarefas > 0 && (
          <Card className="bg-glass border border-glass-border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white/70 uppercase tracking-wider">Progresso do Dia</span>
              <span className="text-2xl font-black text-brand-secondary">{porcentagem}%</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  porcentagem === 100 ? "bg-emerald-500" : porcentagem > 50 ? "bg-brand-secondary" : "bg-amber-500"
                }`}
                style={{ width: `${porcentagem}%` }}
              />
            </div>
            <p className="text-xs text-white/40 mt-2">
              {concluidas} de {totalTarefas} tarefas concluídas
            </p>
          </Card>
        )}

        {/* Filtros de Categoria */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoriaFiltro(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              !categoriaFiltro ? "bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30" : "bg-glass text-white/50 border border-glass-border hover:text-white"
            }`}
          >
            Todas
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setCategoriaFiltro(categoriaFiltro === key ? null : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                categoriaFiltro === key ? `${cfg.badge} border ${cfg.border}` : "bg-glass text-white/50 border border-glass-border hover:text-white"
              }`}
            >
              <cfg.icon size={14} /> {cfg.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isFetching && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-brand-secondary" size={32} />
          </div>
        )}

        {/* Cards por Categoria */}
        {!isFetching && Object.entries(tarefasAgrupadas).map(([categoria, items]) => {
          const cfg = CATEGORY_CONFIG[categoria as keyof typeof CATEGORY_CONFIG];
          const Icon = cfg.icon;
          const categoriaConcluidas = items.filter((t) => t.task.status !== "pendente").length;

          return (
            <Card key={categoria} className={`bg-gradient-to-br ${cfg.color} border ${cfg.border} overflow-hidden`}>
              {/* Header da categoria */}
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={cfg.text} size={20} />
                  <h3 className={`text-sm font-black uppercase tracking-widest ${cfg.text}`}>
                    {cfg.label}
                  </h3>
                  <span className="text-[10px] font-bold text-white/40 bg-black/20 px-2 py-0.5 rounded">
                    {categoriaConcluidas}/{items.length}
                  </span>
                </div>
              </div>

              {/* Lista de Tarefas */}
              <div className="divide-y divide-white/5">
                {items.map((item) => {
                  const { task } = item;
                  const isConcluida = task.status === "concluida";
                  const isNA = task.status === "nao_aplicavel";
                  const isDone = isConcluida || isNA;
                  const isComentarioAberto = comentarioAberto === task.id;

                  return (
                    <div key={task.id} className={`px-6 py-4 transition-all ${isDone ? "opacity-50" : "hover:bg-white/5"}`}>
                      <div className="flex items-center gap-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => !isDone && handleConcluir(task.id)}
                          disabled={isDone || isConcluindo}
                          className="flex-shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="text-emerald-400" size={22} />
                          ) : (
                            <Circle className="text-white/30 hover:text-brand-secondary transition-colors" size={22} />
                          )}
                        </button>

                        {/* Título */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold uppercase ${isDone ? "line-through text-white/40" : "text-white/90"}`}>
                            {task.titulo}
                          </p>
                          {task.descricao && (
                            <p className="text-xs text-white/40 mt-0.5">{task.descricao}</p>
                          )}
                          {task.comentario && (
                            <p className="text-xs text-emerald-400/70 mt-1 italic">
                              💬 {task.comentario}
                            </p>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.condicional && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded" title={task.condicaoTexto || "Quando aplicável"}>
                              <HelpCircle size={12} /> QUANDO APLICÁVEL
                            </span>
                          )}
                          {task.prioridade === "alta" && !isDone && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
                              <AlertTriangle size={12} /> URGENTE
                            </span>
                          )}

                          {/* Ações */}
                          {!isDone && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleComentario(task.id)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                                title="Adicionar observação"
                              >
                                <MessageSquare size={14} />
                              </button>
                              {task.condicional && (
                                <button
                                  onClick={() => marcarNaoAplicavel({ taskId: task.id })}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors text-[10px] font-bold"
                                  title="Marcar como não aplicável hoje"
                                >
                                  N/A
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Campo de Comentário Expandido */}
                      {isComentarioAberto && !isDone && (
                        <div className="mt-3 ml-10 flex items-center gap-2">
                          <Input
                            value={comentarioTexto}
                            onChange={(e) => setComentarioTexto(e.target.value)}
                            placeholder="Adicione uma observação..."
                            className="flex-1 bg-black/20 border-white/10 text-white text-xs h-8"
                            onKeyDown={(e) => e.key === "Enter" && handleConcluir(task.id)}
                          />
                          <button
                            onClick={() => handleConcluir(task.id)}
                            className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                          >
                            Concluir
                          </button>
                          <button
                            onClick={() => { setComentarioAberto(null); setComentarioTexto(""); }}
                            className="text-white/30 hover:text-white p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {/* Estado vazio */}
        {!isFetching && totalTarefas === 0 && (
          <Card className="bg-glass border border-glass-border p-16 text-center">
            <ClipboardCheck className="mx-auto text-white/20 mb-4" size={48} />
            <h3 className="text-lg font-bold text-white/50 uppercase">Nenhuma tarefa para este dia</h3>
            <p className="text-sm text-white/30 mt-2">
              As tarefas serão geradas automaticamente a partir dos templates configurados.
            </p>
          </Card>
        )}

        {/* 100% concluído */}
        {!isFetching && totalTarefas > 0 && porcentagem === 100 && (
          <Card className="bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/30 p-8 text-center">
            <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={40} />
            <h3 className="text-lg font-black text-emerald-400 uppercase">Todas as tarefas concluídas!</h3>
            <p className="text-sm text-emerald-400/60 mt-1">Excelente trabalho! 🎉</p>
          </Card>
        )}
      </div>

      {/* Modal Admin */}
      {isManagerOpen && isAdmin && (
        <TemplateManager onClose={() => setIsManagerOpen(false)} />
      )}
    </MainLayout>
  );
}
