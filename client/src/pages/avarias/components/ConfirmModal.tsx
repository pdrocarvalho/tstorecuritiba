import { Lock } from "lucide-react";
import { useState } from "react";

export type AcaoPin = "edit" | "delete";

interface ConfirmModalProps {
  isOpen: boolean;
  acao: AcaoPin | null;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isPending: boolean;
}

export function ConfirmModal({ isOpen, acao, onClose, onConfirm, isPending }: ConfirmModalProps) {
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(password);
    setPassword("");
  };

  const handleClose = () => {
    setPassword("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl relative overflow-hidden">
        {/* Glow effect at the top */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${acao === "delete" ? "bg-gradient-to-r from-red-500/10 via-red-500 to-red-500/10" : "bg-gradient-to-r from-sky-500/10 via-sky-500 to-sky-500/10"}`} />

        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border transition-all ${acao === "delete" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-sky-500/10 border-sky-500/30 text-sky-400"}`}>
          <Lock size={20} className="animate-pulse" />
        </div>

        <h3 className="text-base font-black tracking-widest text-slate-100 uppercase mb-1">
          {acao === "delete" ? "Excluir Registro" : "Salvar Alterações"}
        </h3>
        
        <p className="text-[10px] font-bold text-slate-400 tracking-wider mb-5 uppercase">
          {acao === "delete" ? "Digite a senha para autorizar exclusão" : "Digite a senha para autorizar edição"}
        </p>

        <input
          type="password"
          className="w-full h-11 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl px-4 mb-6 text-sm outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 text-center placeholder-slate-600 tracking-widest font-mono font-bold transition-all"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />

        <div className="flex gap-3">
          <button 
            onClick={handleClose} 
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-slate-100 rounded-xl uppercase text-[10px] tracking-wider font-bold transition-all border border-slate-700/30"
          >
            CANCELAR
          </button>
          
          <button 
            onClick={handleConfirm} 
            disabled={isPending || !password}
            className={`flex-1 py-2.5 rounded-xl uppercase text-[10px] tracking-wider font-bold disabled:opacity-30 disabled:pointer-events-none transition-all ${
              acao === "delete" 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20" 
                : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20"
            }`}
          >
            {isPending ? "AGUARDE..." : "CONFIRMAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
