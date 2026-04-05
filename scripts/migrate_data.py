import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np

# Configuração da base de dados (exemplo com SQLite para demonstração, mas facilmente alterável para PostgreSQL)
# Para PostgreSQL seria algo como: 'postgresql://user:password@localhost:5432/tstore_curitiba'
db_url = 'sqlite:///tstore_curitiba.db'
engine = create_engine(db_url)

# Carregar o ficheiro Excel
file_path = '/home/ubuntu/projects/t-store-curitiba-99b09b41/BANCO_DE_DADOS-RECEBIMENTO.xlsx'
df = pd.read_excel(file_path)

# Mapeamento de colunas com quebras de linha
col_ref = 'REF.'
col_volumes = 'VOLUMES'
col_descricao = 'DESCRIÇÃO'
col_previsao = 'PREVISÃO\nDE ENTREGA'
col_entrega = 'DATA DE\nENTREGA'

# Limpeza e preparação de dados
df[col_ref] = df[col_ref].astype(str)
df[col_volumes] = pd.to_numeric(df[col_volumes], errors='coerce').fillna(0).astype(int)

# Criar tabelas via SQLAlchemy se necessário (usando o schema SQL definido anteriormente)
with engine.connect() as conn:
    # Como estamos num ambiente sandbox, vamos usar comandos básicos para simular o schema
    conn.execute(text("DROP TABLE IF EXISTS pedidos_rastreio"))
    conn.execute(text("DROP TABLE IF EXISTS produtos"))
    conn.execute(text("DROP TABLE IF EXISTS consultores"))
    conn.execute(text("DROP TABLE IF EXISTS clientes"))

    conn.execute(text("CREATE TABLE IF NOT EXISTS consultores (id INTEGER PRIMARY KEY, nome TEXT, email TEXT)"))
    conn.execute(text("CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY, nome TEXT)"))
    conn.execute(text("CREATE TABLE IF NOT EXISTS produtos (sku TEXT PRIMARY KEY, descricao TEXT)"))
    conn.execute(text("CREATE TABLE IF NOT EXISTS pedidos_rastreio (id INTEGER PRIMARY KEY, produto_sku TEXT, quantidade INTEGER, previsao_entrega DATE, data_entrega DATE, order_status TEXT, notification_sent_status TEXT DEFAULT 'PENDING_FATURADO', consultor_id INTEGER, cliente_id INTEGER)"))
    conn.commit()

# 1. Popular Produtos (unicos por SKU)
produtos_df = df[[col_ref, col_descricao]].drop_duplicates(subset=[col_ref])
produtos_df.columns = ['sku', 'descricao']
produtos_df.to_sql('produtos', engine, if_exists='append', index=False)

# 2. Simulação de Consultores e Clientes (como não estão no Excel principal, criaremos placeholders)
# Em produção, estes dados viriam de outras abas ou seriam inseridos manualmente
consultor_placeholder = pd.DataFrame([{'id': 1, 'nome': 'Consultor Geral', 'email': 'geral@tstore.com'}])
consultor_placeholder.to_sql('consultores', engine, if_exists='append', index=False)

cliente_placeholder = pd.DataFrame([{'id': 1, 'nome': 'Cliente Padrão'}])
cliente_placeholder.to_sql('clientes', engine, if_exists='append', index=False)

# 3. Preparar Pedidos de Rastreio
def determine_status(row):
    if pd.notna(row[col_entrega]):
        return 'Chegou'
    elif pd.notna(row[col_previsao]):
        return 'Previsto'
    else:
        return 'Faturado'

pedidos_df = pd.DataFrame()
pedidos_df['produto_sku'] = df[col_ref]
pedidos_df['quantidade'] = df[col_volumes]
pedidos_df['previsao_entrega'] = pd.to_datetime(df[col_previsao]).dt.date
pedidos_df['data_entrega'] = pd.to_datetime(df[col_entrega]).dt.date
pedidos_df['order_status'] = df.apply(determine_status, axis=1)

# Definir o status inicial de notificação com base no order_status
def set_initial_notification_status(order_status):
    if order_status == 'Faturado':
        return 'PENDING_FATURADO'
    elif order_status == 'Previsto':
        return 'PENDING_PREVISAO'
    elif order_status == 'Chegou':
        return 'PENDING_CHEGOU'
    return 'UNKNOWN'

pedidos_df['notification_sent_status'] = pedidos_df['order_status'].apply(set_initial_notification_status)
pedidos_df['consultor_id'] = 1 # Associando ao placeholder
pedidos_df['cliente_id'] = 1   # Associando ao placeholder

# Inserir Pedidos
pedidos_df.to_sql('pedidos_rastreio', engine, if_exists='append', index=False)

print(f"Migração concluída com sucesso!")
print(f"Total de produtos inseridos: {len(produtos_df)}")
print(f"Total de pedidos inseridos: {len(pedidos_df)}")
