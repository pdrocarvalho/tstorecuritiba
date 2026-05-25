/**
 * client/src/lib/auth.ts
 *
 * Fonte única de verdade para o token de autenticação.
 * Todos os arquivos que precisam ler, salvar ou limpar o token
 * devem importar daqui — nunca usar localStorage diretamente.
 */

const AUTH_TOKEN_KEY = "auth_token";
const USER_ROLE_KEY = "userRole";

/** Lê o token salvo. Retorna null se não existir. */
export const getAuthToken = (): string | null =>
  localStorage.getItem(AUTH_TOKEN_KEY);

/** Salva o token após o login. */
export const setAuthToken = (token: string): void =>
  localStorage.setItem(AUTH_TOKEN_KEY, token);

/** Remove o token e dados de sessão. Usar no logout e em erros de auth. */
export const clearAuthToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  sessionStorage.clear();
};

/** Verifica rapidamente se existe um token salvo (sem validar no servidor). */
export const isTokenPresent = (): boolean =>
  !!localStorage.getItem(AUTH_TOKEN_KEY);