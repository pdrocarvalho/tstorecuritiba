/**
 * client/src/pages/Login.tsx
 *
 * Tela de login com autenticação JWT.
 * Armazena o token no localStorage e redireciona para o dashboard.
 *
 * Nota: Em produção, remova o bloco de credenciais de teste.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";

interface LoginFormState {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  role: string;
}

async function loginRequest(credentials: LoginFormState): Promise<LoginResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error("Credenciais inválidas.");
  }

  return response.json();
}

export default function Login() {
  const [form, setForm] = useState<LoginFormState>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleChange = (field: keyof LoginFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { token, role } = await loginRequest(form);
      localStorage.setItem("token", token);
      localStorage.setItem("userRole", role);
      toast.success("Login realizado com sucesso!");
      setLocation(ROUTES.dashboard);
    } catch (error) {
      toast.error("Erro ao fazer login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md p-8 shadow-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ESTOQUE</h1>
          <p className="text-gray-500 mt-1">T Store Curitiba</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">
              E-mail
            </span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="seu@email.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">
              Senha
            </span>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </label>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2 w-4 h-4" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        {/* Credenciais de teste — remover em produção */}
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              🔑 Credenciais de Teste
            </p>
            <p className="text-xs text-amber-700">
              Admin: admin@tstore.com / admin123
            </p>
            <p className="text-xs text-amber-700">
              Consultor: consultor@tstore.com / consultor123
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
