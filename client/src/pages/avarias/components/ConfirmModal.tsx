import { Lock } from "lucide-react";

export type AcaoPin = "edit" | "delete";

interface ConfirmModalProps {
  isOpen: boolean;
  acao: AcaoPin | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function ConfirmModal({ isOpen, acao, onClose, onConfirm, isPending }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 text-center max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} className="text-slate-700" />
        </div>
        <h3 className="text-lg font-black mb-1 uppercase">Atenção</h3>
        <p className="text-xs text-slate-400 mb-5 uppercase">
          {acao === "delete" ? "Confirme para excluir permanentemente" : "Confirme para salvar as alterações"}
        </p>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 rounded-lg uppercase text-xs font-bold hover:bg-slate-200 transition-colors">CANCELAR</button>
          <button onClick={onConfirm} disabled={isPending}
            className={`flex-1 py-2.5 text-white rounded-lg uppercase text-xs font-bold disabled:opacity-50 transition-colors ${acao === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-[#2563eb] hover:bg-blue-700"}`}>
            {isPending ? "AGUARDE..." : "CONFIRMAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
