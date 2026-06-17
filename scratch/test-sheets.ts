import { google } from "googleapis";

async function testarLeitura() {
  try {
    console.log("Iniciando conexão com o Google Sheets...");
    
    // Autenticação
    const client_email = process.env.GOOGLE_SERVICE_EMAIL;
    const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    
    if (!client_email) throw new Error("GOOGLE_SERVICE_EMAIL não encontrado no process.env");

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email, private_key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = "1HMHQBNpGmV6-4zJpMaxT9btYvmBCPcvXJ6G1YlfoOn0";

    const range = "'DB-ALERTA_DE_DEMANDA'!A1:A";

    console.log(`Buscando quantidade de registros na aba DB-ALERTA_DE_DEMANDA...`);
    
    const responseValues = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const linhas = responseValues.data.values || [];
    const totalRegistros = linhas.filter(row => row[0] && String(row[0]).trim() !== "").length;
    
    console.log(`\n📊 Total de linhas preenchidas na Coluna A: ${linhas.length}`);
    console.log(`📊 Total de registros válidos (sem contar células em branco): ${totalRegistros}`);
    
  } catch (error: any) {
    console.log("\n❌ Falha na conexão ou leitura:");
    console.error(error.message);
  }
}

testarLeitura();
