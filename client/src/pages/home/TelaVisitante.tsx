/**
 * client/src/pages/home/TelaVisitante.tsx
 */
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";

export default function TelaVisitante() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-md px-6 animate-in fade-in duration-700">
        <div className="bg-white p-4 rounded-full shadow-md w-fit mx-auto mb-6">
          <PackageOpen size={48} className="text-blue-600" />
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tight">ESTOQUE</h1>
        <p className="text-xl text-blue-600 font-semibold mt-2 uppercase tracking-widest">T Store Curitiba</p>
        <p className="text-gray-500 mt-4 mb-8 leading-relaxed">
          Plataforma inteligente de rastreamento de pedidos e notificações automáticas.
        </p>
        <a href={getLoginUrl()}>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full text-lg h-12 shadow-lg">
            Fazer Login no Sistema
          </Button>
        </a>
      </div>
    </div>
  );
}