import { Request, Response } from "express";
import { loginWithGoogle, verifyToken } from "../services/auth.service";

export async function login(req: Request, res: Response) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token do Google não fornecido." });
  }

  try {
    const result = await loginWithGoogle(token);
    return res.json(result);
  } catch (error: any) {
    console.error("Erro na verificação do Google/Login:", error);
    if (error.message.includes("Acesso negado") || error.message.includes("E-mail não encontrado")) {
        return res.status(403).json({ message: error.message });
    }
    return res.status(401).json({ message: "Token do Google inválido ou expirado." });
  }
}

export async function me(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Não autenticado." });

  try {
    const token = authHeader.replace("Bearer ", "");
    const user = await verifyToken(token);
    return res.json(user);
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
}
