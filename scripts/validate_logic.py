import pandas as pd

# Carregar o ficheiro Excel
file_path = '/home/ubuntu/projects/t-store-curitiba-99b09b41/BANCO_DE_DADOS-RECEBIMENTO.xlsx'
df = pd.read_excel(file_path)

# Mapeamento de colunas identificadas
# REF. -> Referência
# VOLUMES -> Quantidade
# DESCRIÇÃO -> Descrição
# PREVISÃO DE ENTREGA -> Previsão
# DATA DE ENTREGA -> Entrega

# Lógica das 3 Etapas
# Fase 1 (Faturado): L e M vazias
# Fase 2 (Previsão): L preenchida, M vazia
# Fase 3 (Chegou): M preenchida

# Listar colunas reais para depuração
print("Colunas encontradas:", df.columns.tolist())

# Nomes exatos baseados na saída anterior (podem conter \n)
col_previsao = "PREVISÃO\nDE ENTREGA"
col_entrega = "DATA DE\nENTREGA"

fase_1 = df[df[col_previsao].isna() & df[col_entrega].isna()]
fase_2 = df[df[col_previsao].notna() & df[col_entrega].isna()]
fase_3 = df[df[col_entrega].notna()]

print(f"Total de registos: {len(df)}")
print(f"Registos na Fase 1 (Faturado): {len(fase_1)}")
print(f"Registos na Fase 2 (Previsão): {len(fase_2)}")
print(f"Registos na Fase 3 (Chegou): {len(fase_3)}")

# Amostra de cada fase para validação
if not fase_1.empty:
    print("\nExemplo Fase 1:")
    print(fase_1[['REF.', 'DESCRIÇÃO', col_previsao, col_entrega]].head(1))

if not fase_2.empty:
    print("\nExemplo Fase 2:")
    print(fase_2[['REF.', 'DESCRIÇÃO', col_previsao, col_entrega]].head(1))

if not fase_3.empty:
    print("\nExemplo Fase 3:")
    print(fase_3[['REF.', 'DESCRIÇÃO', col_previsao, col_entrega]].head(1))
