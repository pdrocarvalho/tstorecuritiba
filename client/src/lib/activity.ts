/**
 * client/src/lib/activity.ts
 *
 * Monitor de inatividade — faz logout automático após 1h sem a aba em primeiro plano.
 * Observa: aba em segundo plano, janela sem foco, e aba fechada/reaberta.
 */

import { clearAuthToken, isTokenPresent } from "./auth";

const INATIVIDADE_MS = 60 * 60 * 1000; // 1 hora
const STORAGE_KEY = "session_last_active";

/** Registra o momento atual como última atividade */
export function registrarAtividade() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

/** Verifica se a sessão expirou por inatividade */
export function sessaoExpirou(): boolean {
  if (!isTokenPresent()) return false;

  const ultimaAtividade = localStorage.getItem(STORAGE_KEY);
  if (!ultimaAtividade) return true; // sem registro → considera expirado

  return Date.now() - parseInt(ultimaAtividade) > INATIVIDADE_MS;
}

/** Limpa os dados de sessão e redireciona para o login */
function encerrarSessao() {
  clearAuthToken();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem("session_expired_reason", "Sua sessão expirou por inatividade. Por favor, faça login novamente.");
  window.location.href = "/login";
}

/**
 * Inicializa o monitor de inatividade.
 * Deve ser chamado uma vez ao montar o App, após o login.
 */
export function iniciarMonitorDeAtividade() {
  // Registra atividade inicial
  registrarAtividade();

  // 1. Aba vai para segundo plano ou é fechada
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      // Registra o momento que saiu
      registrarAtividade();
    } else {
      // Voltou — verifica se passou 1h
      if (sessaoExpirou()) {
        encerrarSessao();
      }
    }
  };

  // 2. Janela perde foco (computador bloqueado, outra janela na frente)
  const handleBlur = () => {
    registrarAtividade();
  };

  // 3. Janela volta ao foco
  const handleFocus = () => {
    if (sessaoExpirou()) {
      encerrarSessao();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("focus", handleFocus);

  // Retorna função de cleanup para quando o componente desmontar
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("focus", handleFocus);
  };
}