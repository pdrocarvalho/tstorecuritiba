/**
 * drizzle/seed-tasks.ts
 * Script de importação única dos 48 templates de tarefas extraídos da planilha.
 * Rodar com: npx tsx drizzle/seed-tasks.ts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { taskTemplates } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL!;

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log("🌱 Inserindo templates de tarefas...");

  const templates = [
    // ═══════════════════════════════════════════════════════════════════════
    // ABERTURA — Consultores (21 tarefas)
    // ═══════════════════════════════════════════════════════════════════════
    { titulo: "VERIFICAR HORÁRIO DO CELULAR", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 1 },
    { titulo: "LIGAR MÚSICA", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 2 },
    { titulo: "LIGAR TELEVISÃO", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 3 },
    { titulo: "LIGAR AR CONDICIONADO", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 4 },
    { titulo: "LIGAR MÁQUINA DE CAFÉ", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 5 },
    { titulo: "CONTAR CAIXA", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 6 },
    { titulo: "ABRIR SISTEMAS (CAIXA E ESTOQUE)", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 7 },
    { titulo: "VERIFICAR ECOMMERCE", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 8 },
    { titulo: "REPOR MERCADORIAS", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 9 },
    { titulo: "VERIFICAR INSUMOS BANCADA (PAPEL A4, FITA PRESENTE, ETIQUETAS DE OPERAÇÃO)", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 10 },
    { titulo: "LIMPEZA BANCADA", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 11 },
    { titulo: "VERIFICAR ATUALIZAÇÃO DE PREÇOS (LISTA)", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 12 },
    { titulo: "VERIFICAR OTO", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 13 },
    { titulo: "VERIFICAR MENSAGENS DE CLIENTES DO DIA ANTERIOR (WHATSAPP)", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 14 },
    { titulo: "VERIFICAR GRUPOS DE WHATSAPP", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 15 },
    { titulo: "VERIFICAR CHAT E-MAIL", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 16 },
    { titulo: "LIMPEZA DOS MUNDOS", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 17 },
    { titulo: "VERIFICAR PRODUTOS DE ALTO GIRO (POR MUNDO)", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 18 },
    { titulo: "VERIFICAR ALERTA DE DEMANDA E/OU VENDA FUTURA", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 19 },
    { titulo: "VERIFICAR SE ALGUM REGISTRO DE DEMANDA TEVE ATUALIZAÇÃO", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 20 },
    { titulo: "VERIFICAR SALES FORCE", categoria: "abertura" as const, perfilAlvo: "consultor" as const, ordem: 21, condicional: true, condicaoTexto: "Somente quando algum pedido do e-commerce for finalizado" },

    // ═══════════════════════════════════════════════════════════════════════
    // FECHAMENTO — Consultores (18 tarefas)
    // ═══════════════════════════════════════════════════════════════════════
    { titulo: "VERIFICAR HORÁRIO DO CELULAR (1H PARA CADA CONSULTOR)", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 1 },
    { titulo: "PREENCHER LISTA - REPOSIÇÃO DE MERCADORIAS", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 2 },
    { titulo: "VERIFICAR MENSAGENS DE CLIENTES DO DIA ANTERIOR (WHATSAPP)", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 3 },
    { titulo: "VERIFICAR OTO", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 4 },
    { titulo: "VERIFICAR INSUMOS BANCADA (PAPEL A4, FITA PRESENTE, ETIQUETAS DE OPERAÇÃO)", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 5 },
    { titulo: "LIMPEZA BANCADA", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 6, condicional: true, condicaoTexto: "Verificar dia da semana" },
    { titulo: "LIMPEZA DOS MUNDOS", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 7, condicional: true, condicaoTexto: "Verificar dia da semana" },
    { titulo: "PREENCHER LISTA - REGISTRO DE DEMANDAS (ALERTA E VENDA FUTURA)", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 8 },
    { titulo: "VERIFICAR SE ALGUM REGISTRO DE DEMANDA TEVE ATUALIZAÇÃO", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 9 },
    { titulo: "PREENCHER LISTA - PRODUTOS DE ALTO GIRO (POR MUNDO)", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 10 },
    { titulo: "VERIFICAR SALES FORCE", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 11, condicional: true, condicaoTexto: "Somente quando algum pedido do e-commerce for finalizado" },
    { titulo: "FECHAR SISTEMAS (CAIXA E ESTOQUE) / DESLIGAR COMPUTADORES", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 12 },
    { titulo: "CONTAR CAIXA", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 13 },
    { titulo: "RETIRAR LIXO", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 14 },
    { titulo: "DESLIGAR TELEVISÃO", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 15 },
    { titulo: "DESLIGAR MÁQUINA DE CAFÉ", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 16 },
    { titulo: "DESLIGAR AR CONDICIONADO", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 17 },
    { titulo: "DESLIGAR MÚSICA", categoria: "fechamento" as const, perfilAlvo: "consultor" as const, ordem: 18 },

    // ═══════════════════════════════════════════════════════════════════════
    // ESTOQUE / ADM — Auxiliar Administrativo (9 tarefas)
    // ═══════════════════════════════════════════════════════════════════════
    { titulo: "LIMPEZA LOJA", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 1 },
    { titulo: "RECEBIMENTO MERCADORIAS", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 2 },
    { titulo: "INVENTÁRIO ROTATIVO", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 3, diasSemana: "[1,3,5]", condicional: false },
    { titulo: "PREENCHER PLANILHA DE RECEBIMENTO FUTURO", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 4 },
    { titulo: "PREENCHER PLANILHA REGISTRO DE DEMANDAS", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 5 },
    { titulo: "PREENCHER PLANILHA DE AVARIAS", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 6 },
    { titulo: "PREENCHER PLANILHA DE AJUSTE DE ESTOQUE", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 7 },
    { titulo: "MONITORAR TRATATIVAS DE AVARIAS", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 8 },
    { titulo: "IDENTIFICAR MELHORIAS EM ESTOQUE (ORGANIZAÇÃO, ETIQUETAGEM...)", categoria: "estoque" as const, perfilAlvo: "adm" as const, ordem: 9 },
  ];

  // Insere todos os templates
  const inserted = await db.insert(taskTemplates).values(
    templates.map((t) => ({
      titulo: t.titulo,
      categoria: t.categoria,
      perfilAlvo: t.perfilAlvo,
      ordem: t.ordem,
      condicional: t.condicional ?? false,
      condicaoTexto: t.condicaoTexto ?? null,
      diasSemana: t.diasSemana ?? null,
      ativo: true,
    }))
  ).returning();

  console.log(`✅ ${inserted.length} templates inseridos com sucesso!`);
  console.log(`   - Abertura: 21`);
  console.log(`   - Fechamento: 18`);
  console.log(`   - Estoque/ADM: 9`);

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
