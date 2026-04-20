/**
 * client/src/pages/Login.tsx
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro de autenticação");
      }

      const data = await res.json();
      
      // 🚀 PADRONIZAÇÃO: Agora usamos 'auth_token' para bater com o App.tsx
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("userRole", data.role);
      
      toast.success(`Bem-vindo, ${data.name?.split(" ")[0] || "Usuário"}!`);
      
      // 🚀 REDIRECIONAMENTO FORÇADO: 
      // Limpa erros do Google e garante que o segunrança do App.tsx veja a chave nova.
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);

    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md p-8 shadow-lg flex flex-col items-center animate-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">ESTOQUE</h1>
          <p className="text-sm font-bold text-blue-600 mt-1 uppercase tracking-widest">T Store Curitiba</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="animate-spin text-blue-600 w-10 h-10 mb-4" />
            <p className="text-gray-600 font-medium">Validando acessos...</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center py-2">
            <p className="text-gray-500 text-sm mb-6 text-center">
              Faça login com a sua conta autorizada para aceder ao sistema.
            </p>
            
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                toast.error("O login com o Google falhou ou foi cancelado.");
              }}
              shape="pill"
              theme="filled_blue"
              size="large"
            />
          </div>
        )}
      </Card>
    </div>
  );
}