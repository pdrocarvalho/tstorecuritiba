/**
 * client/src/pages/tarefas/components/TemplateManager.tsx
 * Modal de gerenciamento de templates (Admin)
 */
import { useState } from "react";
import { X, Plus, Edit2, Trash2, CheckCircle, HelpCircle } from "lucide-react";
import { useTarefasAdmin } from "@/_core/hooks/useTarefas";
import { Button } from "@/components/ui/button";

interface TemplateManagerProps {
  onClose: () => void;
}

export default function TemplateManager({ onClose }: TemplateManagerProps) {
  const { templates, isLoadingTemplates, createTemplate, updateTemplate, deleteTemplate } = useTarefasAdmin();
  
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    categoria: "abertura" as any,
    perfilAlvo: "consultor" as any,
    condicional: false,
    condicaoTexto: "",
    diasSemana: "",
  });

  const handleEdit = (t: any) => {
    setIsEditing(t.id);
    setFormData({
      titulo: t.titulo,
      descricao: t.descricao || "",
      categoria: t.categoria,
      perfilAlvo: t.perfilAlvo,
      condicional: t.condicional,
      condicaoTexto: t.condicaoTexto || "",
      diasSemana: t.diasSemana || "",
    });
  };

  const handleSave = () => {
    if (!formData.titulo) return;

    const payload = {
      ...formData,
      diasSemana: formData.diasSemana || undefined,
      condicaoTexto: formData.condicaoTexto || undefined,
    };

    if (isEditing) {
      updateTemplate({ id: isEditing, ...payload });
    } else {
      createTemplate(payload);
    }

    // Limpa o form
    setIsEditing(null);
    setFormData({
      titulo: "",
      descricao: "",
      categoria: "abertura",
      perfilAlvo: "consultor",
      condicional: false,
      condicaoTexto: "",
      diasSemana: "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0A101D] border border-glass-border w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20">
          <div>
            <h2 className="text-xl font-black text-white">Gerenciador de Templates</h2>
            <p className="text-sm text-white/50">Configure as tarefas recorrentes diárias</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex gap-8">
          
          {/* Formulário lateral */}
          <div className="w-1/3 bg-black/20 p-5 rounded-lg border border-white/5 self-start sticky top-0 space-y-4">
            <h3 className="text-sm font-bold text-white mb-4 uppercase">{isEditing ? "Editar Template" : "Novo Template"}</h3>
            
            <div>
              <label className="text-xs font-semibold text-white/60 mb-1 block">Título da Tarefa *</label>
              <input 
                type="text" 
                value={formData.titulo}
                onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                className="w-full bg-black/40 border border-white/10 text-sm text-white rounded p-2 focus:border-brand-secondary focus:outline-none"
                placeholder="Ex: LIGAR MÚSICA"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 mb-1 block">Categoria</label>
              <select 
                value={formData.categoria}
                onChange={e => setFormData({ ...formData, categoria: e.target.value as any })}
                className="w-full bg-black/40 border border-white/10 text-sm text-white rounded p-2 focus:border-brand-secondary focus:outline-none"
              >
                <option value="abertura">Abertura</option>
                <option value="fechamento">Fechamento</option>
                <option value="estoque">Estoque / ADM</option>
                <option value="geral">Geral</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/60 mb-1 block">Perfil Alvo</label>
              <select 
                value={formData.perfilAlvo}
                onChange={e => setFormData({ ...formData, perfilAlvo: e.target.value as any })}
                className="w-full bg-black/40 border border-white/10 text-sm text-white rounded p-2 focus:border-brand-secondary focus:outline-none"
              >
                <option value="consultor">Consultores (Todos)</option>
                <option value="adm">Auxiliar Administrativo</option>
                <option value="todos">Todos os usuários</option>
              </select>
            </div>

            <div className="pt-2 border-t border-white/5">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.condicional}
                  onChange={e => setFormData({ ...formData, condicional: e.target.checked })}
                  className="rounded border-white/20 bg-black/40 text-brand-secondary focus:ring-brand-secondary focus:ring-offset-black"
                />
                Tarefa Condicional (Quando aplicável)
              </label>
            </div>

            {formData.condicional && (
              <div>
                <label className="text-xs font-semibold text-white/60 mb-1 block flex items-center gap-1">
                  Regra da Condição <HelpCircle size={12} />
                </label>
                <input 
                  type="text" 
                  value={formData.condicaoTexto}
                  onChange={e => setFormData({ ...formData, condicaoTexto: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 text-sm text-white rounded p-2 focus:border-brand-secondary focus:outline-none"
                  placeholder="Ex: Apenas quando pedido do e-commerce for finalizado"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-white/60 mb-1 block">Dias Específicos (Opcional)</label>
              <input 
                type="text" 
                value={formData.diasSemana}
                onChange={e => setFormData({ ...formData, diasSemana: e.target.value })}
                className="w-full bg-black/40 border border-white/10 text-sm text-white rounded p-2 focus:border-brand-secondary focus:outline-none"
                placeholder="Ex: [1,3,5] para Seg/Qua/Sex"
              />
            </div>

            <div className="pt-4 flex gap-2">
              <Button onClick={handleSave} className="flex-1 bg-brand-secondary hover:bg-brand-secondary/80 text-black font-bold">
                {isEditing ? "Salvar" : "Criar"}
              </Button>
              {isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(null)} className="flex-1 border-white/20 text-white hover:bg-white/10">
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          {/* Lista de templates */}
          <div className="flex-1 space-y-4">
            <h3 className="text-sm font-bold text-white mb-4 uppercase">Templates Ativos</h3>
            
            {isLoadingTemplates ? (
              <p className="text-white/40 text-sm">Carregando...</p>
            ) : templates.filter((t: any) => t.ativo).length === 0 ? (
              <div className="p-8 text-center bg-black/20 rounded-lg border border-white/5 border-dashed">
                <p className="text-white/40">Nenhum template cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.filter((t: any) => t.ativo).map((t: any) => (
                  <div key={t.id} className="p-3 bg-black/20 border border-white/5 rounded-lg flex items-center justify-between hover:bg-white/5 transition-colors group">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded uppercase bg-white/10 text-white/70">
                          {t.categoria}
                        </span>
                        <p className="text-sm font-bold text-white">{t.titulo}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40 font-semibold uppercase">
                        <span>Alvo: {t.perfilAlvo}</span>
                        {t.condicional && <span className="text-amber-400">Condicional</span>}
                        {t.diasSemana && <span>Dias: {t.diasSemana}</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(t)} className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteTemplate({ id: t.id })} className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors" title="Desativar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
