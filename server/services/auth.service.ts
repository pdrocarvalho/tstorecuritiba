import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { env } from "../_core/env";
import { upsertUser, getUserByOpenId, updateUserRole } from "../repositories/user.repository";
import type { AppJwtPayload, AuthUser, UserRole } from "../_core/auth.types";

const JWT_SECRET = env.JWT_SECRET;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const ADMIN_EMAILS = [
  "pdrolcarvalho@gmail.com",
  "dudubernstorff@gmail.com",
];

const DOMINIO_PERMITIDO = "tramontinastore.com";

const EMAILS_EXCECAO = [
  "pdrolcarvalho@gmail.com",
  "dudubernstorff@gmail.com",
];

export async function loginWithGoogle(token: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("E-mail não encontrado na conta Google.");
  }

  const { email, name } = payload;

  if (!email.endsWith(`@${DOMINIO_PERMITIDO}`) && !EMAILS_EXCECAO.includes(email)) {
    throw new Error(`Acesso negado. Apenas contas @${DOMINIO_PERMITIDO} podem acessar esta plataforma.`);
  }

  await upsertUser({
    openId: email,
    email,
    name: name ?? null,
    loginMethod: "google",
  });

  const roleEsperada = ADMIN_EMAILS.includes(email) ? "admin" : "user";
  await updateUserRole(email, roleEsperada);

  const dbUser = await getUserByOpenId(email);

  const jwtData: AppJwtPayload = { sub: dbUser!.id, email, role: roleEsperada as UserRole };
  const authToken = jwt.sign(jwtData, JWT_SECRET, { expiresIn: "7d" });

  return { token: authToken, role: roleEsperada, name };
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const decoded = jwt.verify(token, JWT_SECRET) as unknown as AppJwtPayload;
  const dbUser = await getUserByOpenId(decoded.email);

  return {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    name: dbUser?.name ?? "Usuário",
  };
}
