/**
 * client/src/pages/Login.tsx
 */
import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { setAuthToken, clearAuthToken } from "@/lib/auth";
import { registrarAtividade } from "@/lib/activity";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const SESSION_EXPIRED_KEY = "session_expired_reason";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [motivoLogout, setMotivoLogout] = useState<string | null>(null);

  useEffect(() => {
    clearAuthToken();
    const motivo = localStorage.getItem(SESSION_EXPIRED_KEY);
    if (motivo) {
      setMotivoLogout(motivo);
      localStorage.removeItem(SESSION_EXPIRED_KEY);
    }
  }, []);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
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

      setAuthToken(data.token);
      if (data.role) localStorage.setItem("userRole", data.role);
      registrarAtividade();

      toast.success(`Bem-vindo, ${data.name?.split(" ")[0] || "Usuário"}!`);

      setTimeout(() => {
        window.location.href = "/";
      }, 1000);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Acesso negado. Verifique suas credenciais.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0F1E" }}>

      {/* PAINEL ESQUERDO — Identidade visual */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-14 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1A35A0 0%, #0A0F1E 100%)" }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(#89B4DE 1px, transparent 1px), linear-gradient(90deg, #89B4DE 1px, transparent 1px)`,
          backgroundSize: "48px 48px"
        }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #89B4DE, transparent)" }} />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #1A35A0, transparent)" }} />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl font-black text-white text-2xl shadow-lg"
            style={{ background: "#1A35A0", border: "2px solid rgba(137,180,222,0.4)" }}>
            T
          </div>
          <div>
            <p className="text-white font-black text-lg tracking-widest uppercase">Tramontina</p>
            <p className="text-xs tracking-widest uppercase" style={{ color: "#89B4DE" }}>Store Curitiba</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
            Sistema de<br />
            <span style={{ color: "#89B4DE" }}>Gestão</span><br />
            de Estoque
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            Plataforma interna de logística, controle de recebimentos e monitoramento de demandas em tempo real.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            {["Recebimento Futuro", "Gestão de Avarias", "Alertas de Demanda"].map(item => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#89B4DE" }} />
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © {new Date().getFullYear()} Tramontina Store Curitiba — Uso Interno
          </p>
        </div>
      </div>

      {/* PAINEL DIREITO — Formulário de login */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">

        <div className="lg:hidden flex items-center gap-3 mb-12">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl font-black text-white text-xl"
            style={{ background: "#1A35A0" }}>
            T
          </div>
          <div>
            <p className="text-white font-black tracking-widest uppercase text-sm">Tramontina</p>
            <p className="text-xs tracking-widest uppercase" style={{ color: "#89B4DE" }}>Store Curitiba</p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">Acesso ao Sistema</h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Utilize sua conta corporativa para entrar.
            </p>
          </div>

          {motivoLogout && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(255,180,0,0.1)", border: "1px solid rgba(255,180,0,0.25)", color: "#FFCC55" }}>
              <Clock size={16} className="flex-shrink-0 mt-0.5" />
              <span>{motivoLogout}</span>
            </div>
          )}

          <div className="rounded-2xl p-7 space-y-6"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)"
            }}>
            <div className="flex items-center gap-2 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <ShieldCheck size={15} style={{ color: "#89B4DE" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89B4DE" }}>
                Acesso restrito — @tramontinastore.com
              </span>
            </div>

            {/* Overlay de loading para não desmontar o GoogleLogin */}
            <div className="relative">
              <div className={`flex flex-col items-center gap-5 transition-opacity duration-300 ${loading ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'}`}>
                <p className="text-xs text-center leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Apenas contas com domínio <strong style={{ color: "rgba(255,255,255,0.65)" }}>@tramontinastore.com</strong> têm acesso a esta plataforma.
                </p>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error("Login com o Google falhou ou foi cancelado.")}
                  shape="pill"
                  theme="filled_blue"
                  size="large"
                />
              </div>

              {loading && (
                <div className="flex flex-col items-center py-6 gap-4 relative z-10">
                  <Loader2 className="animate-spin w-9 h-9" style={{ color: "#1A35A0" }} />
                  <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Validando credenciais...
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 justify-center">
            <AlertTriangle size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
              Sessão encerrada automaticamente após 1h de inatividade
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}