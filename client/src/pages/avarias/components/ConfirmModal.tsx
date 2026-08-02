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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 text-center max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} className="text-slate-700" />
        </div>
        <h3 className="text-lg font-black mb-1 uppercase">Atenção</h3>
        <p className="text-xs text-slate-400 mb-4 uppercase">
          {acao === "delete" ? "Confirme a senha para excluir" : "Confirme a senha para salvar"}
        </p>
        <input
          type="password"
          className="w-full h-10 border border-slate-200 rounded-lg px-3 mb-5 text-sm outline-none focus:ring-2 focus:ring-[#2563eb] text-center"
          placeholder="SENHA DE AUTORIZAÇÃO"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex gap-3">
          <button onClick={handleClose} className="flex-1 py-2.5 bg-slate-100 rounded-lg uppercase text-xs font-bold hover:bg-slate-200 transition-colors">CANCELAR</button>
          <button onClick={handleConfirm} disabled={isPending || !password}
            className={`flex-1 py-2.5 text-white rounded-lg uppercase text-xs font-bold disabled:opacity-50 transition-colors ${acao === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-[#2563eb] hover:bg-blue-700"}`}>
            {isPending ? "AGUARDE..." : "CONFIRMAR"}
          </button>
        </div>
      </div>
    </div>
  );
}
