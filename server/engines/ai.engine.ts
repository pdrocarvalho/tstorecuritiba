/**
 * server/engines/ai.engine.ts
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../_core/env";

// Pega a chave do seu arquivo .env ou do painel do Render
const apiKey = env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.warn("⚠️ GEMINI_API_KEY não foi encontrada nas variáveis de ambiente!");
}

// Inicializa a IA com a sua chave
const genAI = new GoogleGenerativeAI(apiKey);

// Vamos usar o modelo 'flash', que é muito rápido, gratuito e ótimo para textos e imagens
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Função base para conversarmos com a IA
 */
export async function analisarComIA(prompt: string) {
  try {
    const result = await model.generateContent(prompt);
    const resposta = result.response.text();
    return { sucesso: true, dados: resposta };
  } catch (error: any) {
    console.error("❌ Erro ao comunicar com o Gemini:", error);
    return { sucesso: false, erro: error.message };
  }
}